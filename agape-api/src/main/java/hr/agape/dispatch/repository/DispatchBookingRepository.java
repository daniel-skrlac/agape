package hr.agape.dispatch.repository;

import hr.agape.common.database.Jdbc;
import hr.agape.common.dto.PagedResultDTO;
import hr.agape.dispatch.dto.DispatchBookingDetailDTO;
import hr.agape.dispatch.dto.DispatchBookingItemDTO;
import hr.agape.dispatch.dto.DispatchBookingListItemDTO;
import hr.agape.dispatch.dto.DispatchBookingsQueryDTO;
import hr.agape.dispatch.enumeration.DispatchBookingStatus;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class DispatchBookingRepository {

    private final Jdbc jdbc;

    @Inject
    public DispatchBookingRepository(Jdbc jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * In some environments STORNO flag might not be reliable/filled.
     * Consider document cancelled if any storno evidence exists.
     */
    private static final String IS_CANCELLED_EXPR =
            "(NVL(g.STORNO,0) = 1 OR g.DATUM_STORNO IS NOT NULL OR g.STORNIRAO IS NOT NULL)";

    public PagedResultDTO<DispatchBookingListItemDTO> pageBookings(DispatchBookingsQueryDTO q) throws SQLException {

        final int page = Math.max(0, q.getPage());
        final int size = clamp(q.getSize(), 1, 200);
        final int offset = page * size;

        final Long warehouseId = q.getWarehouseId(); // OPTIONAL
        final String like = normLike(q.getQ());
        final String docCode = trimToNull(q.getDocumentCode()); // e.g. OTPREMNICA
        final DispatchBookingStatus status = (q.getStatus() == null) ? DispatchBookingStatus.ALL : q.getStatus();
        final LocalDate from = q.getDateFrom();
        final LocalDate to = q.getDateTo();

        /*
         * rpick chooses:
         * - SD_SIFREZ_ID_MATCH: a SD_SIFREZ row whose DOKUMENTID matches docCode (if docCode provided)
         * - SD_SIFREZ_ID_ANY: fallback for display when docCode is null
         */
        final String fromJoin = """
            FROM SD_GLAVA g
            JOIN (
              SELECT
                r.DOKUMENT_ID,
                MIN(CASE
                      WHEN ? IS NOT NULL AND UPPER(z.DOKUMENTID) = UPPER(?)
                      THEN r.SD_SIFREZ_ID
                    END) AS SD_SIFREZ_ID_MATCH,
                MIN(r.SD_SIFREZ_ID) AS SD_SIFREZ_ID_ANY
              FROM SD_SIFREG r
              JOIN SD_SIFREZ z ON z.SD_SIFREZ_ID = r.SD_SIFREZ_ID
              GROUP BY r.DOKUMENT_ID
            ) rp ON rp.DOKUMENT_ID = g.DOKUMENT_ID
            JOIN SD_SIFREZ z
              ON z.SD_SIFREZ_ID = NVL(rp.SD_SIFREZ_ID_MATCH, rp.SD_SIFREZ_ID_ANY)
            LEFT JOIN PARTNERI p ON p.PARTNER_ID = g.PARTNER_ID
            """;

        // NOTE: Oracle has no TRUE/FALSE in SQL -> use NOT(expr) / expr
        final String baseWhere = """
            WHERE ( ? IS NULL OR EXISTS (
                     SELECT 1
                     FROM SD_SIFREG rr
                     WHERE rr.DOKUMENT_ID = g.DOKUMENT_ID
                       AND rr.SKLADISTE_ID = ?
                   ) )
              AND ( ? IS NULL OR EXISTS (
                     SELECT 1
                     FROM SD_SIFREG rr
                     JOIN SD_SIFREZ zz ON zz.SD_SIFREZ_ID = rr.SD_SIFREZ_ID
                     WHERE rr.DOKUMENT_ID = g.DOKUMENT_ID
                       AND UPPER(zz.DOKUMENTID) = UPPER(?)
                   ) )
              AND (
                   ? IS NULL
                   OR LOWER(z.NAZIVDOKUMENTA) LIKE ?
                   OR LOWER(z.DOKUMENTID) LIKE ?
                   OR LOWER(p.NAZIV) LIKE ?
                   OR TO_CHAR(p.PARTNERID) LIKE ?
              )
              AND (
                   ? = 'ALL'
                   OR ( ? = 'DRAFT'     AND NVL(g.KNJIZENO,0) = 0 AND NOT %s )
                   OR ( ? = 'FINAL'     AND NVL(g.KNJIZENO,0) = 1 AND NOT %s )
                   OR ( ? = 'CANCELLED' AND %s )
              )
              AND ( ? IS NULL OR TRUNC(NVL(g.DATUM_KNJIZENJA, g.DATUM_IZRADE)) >= ? )
              AND ( ? IS NULL OR TRUNC(NVL(g.DATUM_KNJIZENJA, g.DATUM_IZRADE)) <= ? )
            """.formatted(IS_CANCELLED_EXPR, IS_CANCELLED_EXPR, IS_CANCELLED_EXPR);

        final String countSql = "SELECT COUNT(*) " + fromJoin + baseWhere;

        final String pageSql = ("""
            SELECT *
            FROM (
              SELECT
                g.ID               AS HEADER_ID,
                g.DOKUMENT_ID      AS DOCUMENT_ID,
                z.DOKUMENTID       AS DOCUMENT_CODE,
                z.NAZIVDOKUMENTA   AS DOCUMENT_NAME,
                g.DOKUMENTBR       AS DOCUMENT_BR,
                g.PARTNER_ID       AS PARTNER_ID,
                p.NAZIV            AS PARTNER_NAME,
                NVL(g.DATUM_KNJIZENJA, g.DATUM_IZRADE) AS BOOKED_AT,
                NVL(g.KNJIZENO,0)  AS KNJIZENO,
                CASE WHEN %s THEN 1 ELSE 0 END AS STORNO,
                ROW_NUMBER() OVER (
                  ORDER BY NVL(g.DATUM_KNJIZENJA, g.DATUM_IZRADE) DESC, g.ID DESC
                ) AS RN
            """.formatted(IS_CANCELLED_EXPR))
                + fromJoin + baseWhere + """
            )
            WHERE RN BETWEEN ? AND ?
            """;

        return jdbc.withConnection(c -> {
            long total;

            try (PreparedStatement ps = c.prepareStatement(countSql)) {
                bindCommon(ps, warehouseId, docCode, like, status, from, to);
                try (ResultSet rs = ps.executeQuery()) {
                    rs.next();
                    total = rs.getLong(1);
                }
            }

            final List<DispatchBookingListItemDTO> items = new ArrayList<>();
            if (total > 0) {
                try (PreparedStatement ps = c.prepareStatement(pageSql)) {
                    int idx = bindCommon(ps, warehouseId, docCode, like, status, from, to);

                    int start = offset + 1;
                    int end = offset + size;
                    ps.setInt(idx++, start);
                    ps.setInt(idx++, end);

                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            items.add(DispatchBookingListItemDTO.builder()
                                    .headerId(rs.getLong("HEADER_ID"))
                                    .documentId(rs.getLong("DOCUMENT_ID"))
                                    .documentCode(rs.getString("DOCUMENT_CODE"))
                                    .documentName(rs.getString("DOCUMENT_NAME"))
                                    .documentBr(rs.getLong("DOCUMENT_BR"))
                                    .partnerId(rs.getObject("PARTNER_ID") == null ? null : rs.getLong("PARTNER_ID"))
                                    .partnerName(rs.getString("PARTNER_NAME"))
                                    .bookedAt(toOffsetDateTime(rs.getTimestamp("BOOKED_AT")))
                                    .posted(rs.getInt("KNJIZENO") == 1)
                                    .cancelled(rs.getInt("STORNO") == 1)
                                    .build());
                        }
                    }
                }
            }

            return PagedResultDTO.<DispatchBookingListItemDTO>builder()
                    .items(items)
                    .page(page)
                    .size(size)
                    .total(total)
                    .build();
        });
    }

    public DispatchBookingDetailDTO getBookingDetail(Long headerId) throws SQLException {

        final String headerSql = """
            SELECT
              g.ID                                  AS HEADER_ID,
              r.SKLADISTE_ID                        AS WAREHOUSE_ID,
              g.DOKUMENT_ID                         AS DOCUMENT_ID,
              g.DOKUMENTBR                          AS DOCUMENT_BR,
              g.DATUM_DOKUMENTA                     AS DOCUMENT_DATE,
              NVL(g.DATUM_KNJIZENJA, g.DATUM_IZRADE) AS BOOKED_AT,
              g.PARTNER_ID                          AS PARTNER_ID,
              p.NAZIV                               AS PARTNER_NAME,
              NVL(g.KNJIZENO, 0)                    AS KNJIZENO,
              CASE WHEN %s THEN 1 ELSE 0 END        AS STORNO,
              g.IZRADIO                             AS CREATED_BY,
              g.DATUM_IZRADE                        AS CREATED_AT,
              g.KNJIZIO                             AS POSTED_BY,
              g.DATUM_KNJIZENJA                     AS POSTED_AT,
              g.STORNIRAO                           AS CANCELLED_BY,
              g.DATUM_STORNO                        AS CANCELLED_AT,
              z.DOKUMENTID                          AS DOCUMENT_CODE,
              z.NAZIVDOKUMENTA                      AS DOCUMENT_NAME
            FROM SD_GLAVA g
            JOIN SD_SIFREG r ON r.DOKUMENT_ID = g.DOKUMENT_ID
            JOIN SD_SIFREZ z ON z.SD_SIFREZ_ID = r.SD_SIFREZ_ID
            LEFT JOIN PARTNERI p ON p.PARTNER_ID = g.PARTNER_ID
            WHERE g.ID = ?
              AND ROWNUM = 1
            """.formatted(IS_CANCELLED_EXPR);

        final String itemsSql = """
            SELECT
              s.ID            AS ROW_ID,
              s.ARTIKL_ID     AS ARTIKL_ID,
              s.NAZIV_ID      AS NAZIV_ID,
              s.KOLICINA      AS KOLICINA,
              az.ARTIKLID     AS ITEM_CODE,
              n.NAZIV         AS ITEM_NAME,
              u.JEDINICAMJERE AS UNIT
            FROM SD_STAVKE s
            LEFT JOIN SKL_ARTIKLIG g ON g.ARTIKL_ID = s.ARTIKL_ID
            LEFT JOIN SKL_ARTIKLIZ az ON az.ARTIKLIZ_ID = g.ARTIKLIZ_ID
            LEFT JOIN SKL_ANAZIVI n ON n.NAZIV_ID = s.NAZIV_ID
            LEFT JOIN SIFRE_JMJ u ON u.JMJ_ID = s.JMJ_ID
            WHERE s.SD_GLAVA_ID = ?
            ORDER BY s.STAVKABR
            """;

        return jdbc.withConnection(c -> {

            DispatchBookingDetailDTO header;

            try (PreparedStatement ps = c.prepareStatement(headerSql)) {
                ps.setLong(1, headerId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) return null;

                    header = DispatchBookingDetailDTO.builder()
                            .headerId(rs.getLong("HEADER_ID"))
                            .warehouseId(rs.getObject("WAREHOUSE_ID") == null ? null : rs.getLong("WAREHOUSE_ID"))
                            .documentId(rs.getLong("DOCUMENT_ID"))
                            .documentCode(rs.getString("DOCUMENT_CODE"))
                            .documentName(rs.getString("DOCUMENT_NAME"))
                            .documentBr(rs.getLong("DOCUMENT_BR"))
                            .documentDate(toOffsetDateTime(rs.getTimestamp("DOCUMENT_DATE")))
                            .bookedAt(toOffsetDateTime(rs.getTimestamp("BOOKED_AT")))
                            .partnerId(rs.getObject("PARTNER_ID") == null ? null : rs.getLong("PARTNER_ID"))
                            .partnerName(rs.getString("PARTNER_NAME"))
                            .posted(rs.getInt("KNJIZENO") == 1)
                            .cancelled(rs.getInt("STORNO") == 1)
                            .createdBy(rs.getObject("CREATED_BY") == null ? null : rs.getLong("CREATED_BY"))
                            .createdAt(toOffsetDateTime(rs.getTimestamp("CREATED_AT")))
                            .postedBy(rs.getObject("POSTED_BY") == null ? null : rs.getLong("POSTED_BY"))
                            .postedAt(toOffsetDateTime(rs.getTimestamp("POSTED_AT")))
                            .cancelledBy(rs.getObject("CANCELLED_BY") == null ? null : rs.getLong("CANCELLED_BY"))
                            .cancelledAt(toOffsetDateTime(rs.getTimestamp("CANCELLED_AT")))
                            .items(new ArrayList<>())
                            .build();
                }
            }

            try (PreparedStatement ps = c.prepareStatement(itemsSql)) {
                ps.setLong(1, headerId);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        header.getItems().add(DispatchBookingItemDTO.builder()
                                .itemRowId(rs.getLong("ROW_ID"))
                                .itemId(rs.getLong("ARTIKL_ID"))
                                .nazivId(rs.getLong("NAZIV_ID"))
                                .quantity(rs.getBigDecimal("KOLICINA"))
                                .itemCode(rs.getString("ITEM_CODE"))
                                .name(rs.getString("ITEM_NAME"))
                                .unit(rs.getString("UNIT"))
                                .build());
                    }
                }
            }

            return header;
        });
    }

    private static int bindCommon(
            PreparedStatement ps,
            Long warehouseId,
            String documentCode,
            String like,
            DispatchBookingStatus status,
            LocalDate from,
            LocalDate to
    ) throws SQLException {
        int i = 1;

        // rpick: docCode used twice
        ps.setString(i++, documentCode);
        ps.setString(i++, documentCode);

        // warehouse EXISTS: (? IS NULL OR EXISTS ... SKLADISTE_ID = ?)
        ps.setObject(i++, warehouseId);
        ps.setObject(i++, warehouseId);

        // documentCode EXISTS: (? IS NULL OR EXISTS ... zz.DOKUMENTID = ?)
        ps.setString(i++, documentCode);
        ps.setString(i++, documentCode);

        // text filter group
        ps.setString(i++, like);
        ps.setString(i++, like);
        ps.setString(i++, like);
        ps.setString(i++, like);
        ps.setString(i++, like);

        // status (bound 4x)
        String st = status == null ? "ALL" : status.name();
        ps.setString(i++, st);
        ps.setString(i++, st);
        ps.setString(i++, st);
        ps.setString(i++, st);

        // date from/to
        if (from == null) {
            ps.setObject(i++, null);
            ps.setObject(i++, null);
        } else {
            ps.setDate(i++, Date.valueOf(from));
            ps.setDate(i++, Date.valueOf(from));
        }

        if (to == null) {
            ps.setObject(i++, null);
            ps.setObject(i++, null);
        } else {
            ps.setDate(i++, Date.valueOf(to));
            ps.setDate(i++, Date.valueOf(to));
        }

        return i;
    }

    private static OffsetDateTime toOffsetDateTime(Timestamp ts) {
        if (ts == null) return null;
        return ts.toInstant().atOffset(ZoneOffset.UTC);
    }

    private static int clamp(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String normLike(String q) {
        String t = trimToNull(q);
        if (t == null) return null;
        return "%" + t.toLowerCase() + "%";
    }
}

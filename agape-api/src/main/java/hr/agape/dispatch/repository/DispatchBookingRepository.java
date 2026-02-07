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

    public PagedResultDTO<DispatchBookingListItemDTO> pageBookings(
            Long warehouseId,
            Long resolvedDocumentId,
            DispatchBookingsQueryDTO q
    ) throws SQLException {

        final int page = Math.max(0, q.getPage());
        final int size = clamp(q.getSize(), 1, 200);
        final int offset = page * size;

        final String like = normLike(q.getQ()); // reused for doc+partner
        final String docCode = trimToNull(q.getDocumentCode());
        final DispatchBookingStatus status = (q.getStatus() == null) ? DispatchBookingStatus.ALL : q.getStatus();

        final LocalDate from = q.getDateFrom();
        final LocalDate to = q.getDateTo();

        // NOTE:
        // - Search now matches:
        //   - document name (SD_SIFREZ.NAZIVDOKUMENTA)
        //   - document code (SD_SIFREZ.DOKUMENTID)
        //   - partner name (PARTNERI.NAZIV)
        //   - partner business id (PARTNERI.PARTNERID)
        final String baseWhere = """
                WHERE g.DOKUMENT_ID = ?
                  AND (
                       ? IS NULL
                       OR LOWER(z.NAZIVDOKUMENTA) LIKE ?
                       OR LOWER(z.DOKUMENTID) LIKE ?
                       OR LOWER(p.NAZIV) LIKE ?
                       OR TO_CHAR(p.PARTNERID) LIKE ?
                  )
                  AND ( ? IS NULL OR UPPER(z.DOKUMENTID) = UPPER(?) )
                  AND ( ? = 'ALL'
                        OR ( ? = 'DRAFT' AND NVL(g.KNJIZENO,0) = 0 AND NVL(g.STORNO,0) = 0 )
                        OR ( ? = 'FINAL' AND NVL(g.KNJIZENO,0) = 1 AND NVL(g.STORNO,0) = 0 )
                      )
                  AND ( ? IS NULL OR TRUNC(NVL(g.DATUM_KNJIZENJA, g.DATUM_IZRADE)) >= ? )
                  AND ( ? IS NULL OR TRUNC(NVL(g.DATUM_KNJIZENJA, g.DATUM_IZRADE)) <= ? )
                """;

        final String countSql = """
                SELECT COUNT(*)
                  FROM SD_GLAVA g
                  JOIN SD_SIFREG r ON r.DOKUMENT_ID = g.DOKUMENT_ID
                  JOIN SD_SIFREZ z ON z.SD_SIFREZ_ID = r.SD_SIFREZ_ID
                  LEFT JOIN PARTNERI p ON p.PARTNER_ID = g.PARTNER_ID
                """ + baseWhere;

        final String pageSql = """
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
                    NVL(g.STORNO,0)    AS STORNO,
                    ROW_NUMBER() OVER (
                      ORDER BY NVL(g.DATUM_KNJIZENJA, g.DATUM_IZRADE) DESC, g.ID DESC
                    ) AS RN
                  FROM SD_GLAVA g
                  JOIN SD_SIFREG r ON r.DOKUMENT_ID = g.DOKUMENT_ID
                  JOIN SD_SIFREZ z ON z.SD_SIFREZ_ID = r.SD_SIFREZ_ID
                  LEFT JOIN PARTNERI p ON p.PARTNER_ID = g.PARTNER_ID
                """ + baseWhere + """
                )
                WHERE RN BETWEEN ? AND ?
                """;

        return jdbc.withConnection(c -> {
            long total;
            try (PreparedStatement ps = c.prepareStatement(countSql)) {
                bindCommon(ps, resolvedDocumentId, like, docCode, status, from, to);
                try (ResultSet rs = ps.executeQuery()) {
                    rs.next();
                    total = rs.getLong(1);
                }
            }

            final List<DispatchBookingListItemDTO> items = new ArrayList<>();
            if (total > 0) {
                try (PreparedStatement ps = c.prepareStatement(pageSql)) {
                    int idx = bindCommon(ps, resolvedDocumentId, like, docCode, status, from, to);

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

    // unchanged
    public DispatchBookingDetailDTO getBookingDetail(Long headerId) throws SQLException {
        // keep your existing detail() method as-is (it already returns partnerId + partnerName)
        // ...
        throw new UnsupportedOperationException("keep your existing implementation here");
    }

    /**
     * Bind params for baseWhere.
     * Order MUST match baseWhere.
     */
    private static int bindCommon(
            PreparedStatement ps,
            Long resolvedDocumentId,
            String like,
            String documentCode,
            DispatchBookingStatus status,
            LocalDate from,
            LocalDate to
    ) throws SQLException {
        int i = 1;

        // g.DOKUMENT_ID = ?
        ps.setLong(i++, resolvedDocumentId);

        // text filter group:
        // ? IS NULL
        ps.setString(i++, like);

        // LOWER(z.NAZIVDOKUMENTA) LIKE ?
        ps.setString(i++, like);

        // LOWER(z.DOKUMENTID) LIKE ?
        ps.setString(i++, like);

        // LOWER(p.NAZIV) LIKE ?
        ps.setString(i++, like);

        // TO_CHAR(p.PARTNERID) LIKE ?
        // if like is "%abc%" it's fine; numeric search also works ("%123%")
        ps.setString(i++, like);

        // document code exact
        ps.setString(i++, documentCode);
        ps.setString(i++, documentCode);

        // status
        String st = status == null ? "ALL" : status.name();
        ps.setString(i++, st);
        ps.setString(i++, st);
        ps.setString(i++, st);

        // date from/to against TRUNC(bookedAt)
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

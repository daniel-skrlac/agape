package hr.agape.document.repository;

import hr.agape.common.util.TimeUtil;
import hr.agape.dispatch.dto.DispatchSearchFilter;
import hr.agape.document.domain.DocumentHeaderEntity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import oracle.jdbc.OraclePreparedStatement;
import oracle.jdbc.OracleTypes;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class DocumentHeaderRepository {

    private final DataSource dataSource;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public DocumentHeaderRepository(@io.quarkus.agroal.DataSource("oracle") DataSource dataSource) {
        this.dataSource = dataSource;
    }

    /**
     * FIX: Always insert as DRAFT (KNJIZENO=0). Posting is done via Oracle procedure (KNJIZI_MK...).
     */
    public DocumentHeaderEntity insert(DocumentHeaderEntity h, boolean ignoredPostNow) throws SQLException {
        try (Connection c = dataSource.getConnection()) {
            return doInsertHeader(c, h);
        }
    }

    private DocumentHeaderEntity doInsertHeader(Connection c, DocumentHeaderEntity h) throws SQLException {

        final String sql = """
                INSERT INTO SD_GLAVA
                  (DOKUMENT_ID,
                   DATUM_DOKUMENTA,
                   PARTNER_ID,
                   IZRADIO,
                   DOKUMENTBR,
                   KNJIZENO,
                   KNJIZIO,
                   DATUM_KNJIZENJA,
                   DATUM_IZRADE)
                VALUES (?, ?, ?, ?, NULL, 0, NULL, NULL, SYSDATE)
                RETURNING ID,
                          DOKUMENTBR,
                          DATUM_DOKUMENTA,
                          DATUM_IZRADE,
                          KNJIZENO,
                          KNJIZIO,
                          DATUM_KNJIZENJA,
                          STORNIRAO,
                          DATUM_STORNO,
                          NAPOMENA
                INTO ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                """;

        try (PreparedStatement ps = c.prepareStatement(sql)) {
            OraclePreparedStatement ops = ps.unwrap(OraclePreparedStatement.class);

            if (h.getDocumentId() != null) ops.setLong(1, h.getDocumentId());
            else ops.setNull(1, Types.NUMERIC);

            if (h.getDocumentDate() != null) ops.setDate(2, Date.valueOf(h.getDocumentDate()));
            else ops.setNull(2, Types.DATE);

            if (h.getPartnerId() != null) ops.setLong(3, h.getPartnerId());
            else ops.setNull(3, Types.NUMERIC);

            if (h.getCreatedBy() != null) ops.setLong(4, h.getCreatedBy());
            else ops.setNull(4, Types.NUMERIC);

            ops.registerReturnParameter(5, OracleTypes.NUMBER);     // ID
            ops.registerReturnParameter(6, OracleTypes.NUMBER);     // DOKUMENTBR
            ops.registerReturnParameter(7, OracleTypes.DATE);       // DATUM_DOKUMENTA
            ops.registerReturnParameter(8, OracleTypes.TIMESTAMP);  // DATUM_IZRADE
            ops.registerReturnParameter(9, OracleTypes.NUMBER);     // KNJIZENO
            ops.registerReturnParameter(10, OracleTypes.NUMBER);    // KNJIZIO
            ops.registerReturnParameter(11, OracleTypes.TIMESTAMP); // DATUM_KNJIZENJA
            ops.registerReturnParameter(12, OracleTypes.NUMBER);    // STORNIRAO
            ops.registerReturnParameter(13, OracleTypes.TIMESTAMP); // DATUM_STORNO
            ops.registerReturnParameter(14, OracleTypes.CLOB);      // NAPOMENA

            ops.executeUpdate();

            try (ResultSet rs = ops.getReturnResultSet()) {
                rs.next();

                long id = rs.getLong(1);

                Long documentNumber = rs.getLong(2);
                if (rs.wasNull()) documentNumber = null;

                Date dd = rs.getDate(3);
                LocalDate normalizedDocDate = (dd != null ? dd.toLocalDate() : null);

                Timestamp tsCreated = rs.getTimestamp(4);
                OffsetDateTime createdAt = TimeUtil.oracleTimestampToZagreb(tsCreated);

                boolean posted = (rs.getLong(5) == 1);

                Long postedBy = rs.getLong(6);
                if (rs.wasNull()) postedBy = null;

                Timestamp tsPosted = rs.getTimestamp(7);
                OffsetDateTime postedAt = TimeUtil.oracleTimestampToZagreb(tsPosted);

                Long cancelledBy = rs.getLong(8);
                if (rs.wasNull()) cancelledBy = null;

                Timestamp tsStorno = rs.getTimestamp(9);
                OffsetDateTime cancelledAt = TimeUtil.oracleTimestampToZagreb(tsStorno);

                String note = rs.getString(10);

                return DocumentHeaderEntity.builder()
                        .id(id)
                        .documentId(h.getDocumentId())
                        .documentNumber(documentNumber)
                        .documentDate(normalizedDocDate)
                        .partnerId(h.getPartnerId())
                        .createdBy(h.getCreatedBy())
                        .createdAt(createdAt)
                        .posted(posted)
                        .postedBy(postedBy)
                        .postedAt(postedAt)
                        .cancelledBy(cancelledBy)
                        .cancelledAt(cancelledAt)
                        .cancelNote(note)
                        .build();
            }
        }
    }

    public DocumentHeaderEntity findHeader(Long id) throws SQLException {
        final String sql = """
                SELECT
                  g.ID,
                  g.DOKUMENT_ID,
                  g.DOKUMENTBR,
                  g.DATUM_DOKUMENTA,
                  g.PARTNER_ID,
                  g.IZRADIO,
                  g.DATUM_IZRADE,
                  g.KNJIZENO,
                  g.KNJIZIO,
                  g.DATUM_KNJIZENJA,
                  g.STORNIRAO,
                  g.DATUM_STORNO,
                  g.NAPOMENA
                FROM SD_GLAVA g
                WHERE g.ID = ?
                """;

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            ps.setLong(1, id);

            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                return mapRowToEntity(rs);
            }
        }
    }

    /**
     * Optional: stays if we ever want to post without procedure.
     */
    public DocumentHeaderEntity postDispatch(Long headerId, Long actorOib) throws SQLException {
        final String sql = """
                UPDATE SD_GLAVA
                   SET KNJIZENO = 1,
                       KNJIZIO = ?,
                       DATUM_KNJIZENJA = SYSDATE
                 WHERE ID = ?
                   AND KNJIZENO = 0
                   AND STORNIRAO IS NULL
                """;

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            if (actorOib != null) ps.setLong(1, actorOib);
            else ps.setNull(1, Types.NUMERIC);
            ps.setLong(2, headerId);

            int updated = ps.executeUpdate();
            if (updated == 0) return null;
        }

        return findHeader(headerId);
    }

    public DocumentHeaderEntity updateDraftHeader(Long headerId, Long partnerId, String note) throws SQLException {
        final String sql = """
                UPDATE SD_GLAVA
                   SET PARTNER_ID = COALESCE(?, PARTNER_ID),
                       NAPOMENA   = COALESCE(?, NAPOMENA),
                       IZMIJENIO  = COALESCE(?, IZMIJENIO),
                       DATUM_IZMJENE = SYSDATE
                 WHERE ID = ?
                   AND KNJIZENO = 0
                   AND STORNIRAO IS NULL
                """;

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            if (partnerId != null) ps.setLong(1, partnerId);
            else ps.setNull(1, Types.NUMERIC);

            if (note != null) ps.setString(2, note);
            else ps.setNull(2, Types.CLOB);

            ps.setNull(3, Types.NUMERIC);
            ps.setLong(4, headerId);

            int updated = ps.executeUpdate();
            if (updated == 0) return null;
        }

        return findHeader(headerId);
    }

    public DocumentHeaderEntity cancelDispatch(Long headerId, Long actorOib, String reason) throws SQLException {
        final String sql = """
                UPDATE SD_GLAVA
                   SET STORNIRAO     = ?,
                       DATUM_STORNO  = SYSDATE,
                       NAPOMENA      = ?
                 WHERE ID = ?
                   AND KNJIZENO = 1
                   AND STORNIRAO IS NULL
                """;

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            if (actorOib != null) ps.setLong(1, actorOib);
            else ps.setNull(1, Types.NUMERIC);

            if (reason != null) ps.setString(2, reason);
            else ps.setNull(2, Types.CLOB);

            ps.setLong(3, headerId);

            int updated = ps.executeUpdate();
            if (updated == 0) return null;
        }

        return findHeader(headerId);
    }

    public long countFiltered(DispatchSearchFilter filter) throws SQLException {
        StringBuilder sql = new StringBuilder("""
                SELECT COUNT(*) AS CNT
                  FROM SD_GLAVA g
                 WHERE 1=1
                """);

        List<Object> params = new ArrayList<>();
        addWhereClauses(filter, sql, params);

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql.toString())) {

            bindParams(ps, params);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getLong("CNT");
            }
        }
    }

    public List<DocumentHeaderEntity> pageFiltered(DispatchSearchFilter filter) throws SQLException {
        int page = Math.max(0, filter.getPage());
        int size = Math.max(1, filter.getSize());
        int start = page * size + 1;
        int end = page * size + size;

        StringBuilder inner = new StringBuilder("""
                SELECT
                  g.ID,
                  g.DOKUMENT_ID,
                  g.DOKUMENTBR,
                  g.DATUM_DOKUMENTA,
                  g.PARTNER_ID,
                  g.IZRADIO,
                  g.DATUM_IZRADE,
                  g.KNJIZENO,
                  g.KNJIZIO,
                  g.DATUM_KNJIZENJA,
                  g.STORNIRAO,
                  g.DATUM_STORNO,
                  g.NAPOMENA
                FROM SD_GLAVA g
                WHERE 1=1
                """);

        List<Object> params = new ArrayList<>();
        addWhereClauses(filter, inner, params);

        inner.append(" ORDER BY g.DATUM_DOKUMENTA DESC, g.ID DESC ");

        String pagedSql = """
                SELECT * FROM (
                    SELECT inner_q.*, ROWNUM rn
                    FROM (
                """ + inner + """
                    ) inner_q
                    WHERE ROWNUM <= ?
                )
                WHERE rn >= ?
                """;

        List<DocumentHeaderEntity> out = new ArrayList<>(size);

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(pagedSql)) {

            int idx = bindParams(ps, params);
            ps.setInt(idx++, end);
            ps.setInt(idx, start);

            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) out.add(mapRowToEntity(rs));
            }
        }

        return out;
    }

    private static void addWhereClauses(DispatchSearchFilter f, StringBuilder sql, List<Object> params) {
        if (f.getDocumentId() != null) {
            sql.append(" AND g.DOKUMENT_ID = ? ");
            params.add(f.getDocumentId());
        }
        if (f.getCreatedBy() != null) {
            sql.append(" AND g.IZRADIO = ? ");
            params.add(f.getCreatedBy());
        }
        if (f.getPartnerId() != null) {
            sql.append(" AND g.PARTNER_ID = ? ");
            params.add(f.getPartnerId());
        }
        if (f.getDateFrom() != null) {
            sql.append(" AND g.DATUM_DOKUMENTA >= ? ");
            params.add(Date.valueOf(f.getDateFrom()));
        }
        if (f.getDateTo() != null) {
            sql.append(" AND g.DATUM_DOKUMENTA <= ? ");
            params.add(Date.valueOf(f.getDateTo()));
        }
    }

    private static int bindParams(PreparedStatement ps, List<Object> params) throws SQLException {
        int i = 1;
        for (Object val : params) {
            if (val instanceof Long v) ps.setLong(i++, v);
            else if (val instanceof Integer v) ps.setInt(i++, v);
            else if (val instanceof Date v) ps.setDate(i++, v);
            else ps.setObject(i++, val);
        }
        return i;
    }

    private static DocumentHeaderEntity mapRowToEntity(ResultSet rs) throws SQLException {
        Date docDateSql = rs.getDate("DATUM_DOKUMENTA");
        LocalDate documentDate = (docDateSql != null ? docDateSql.toLocalDate() : null);

        Timestamp createdAtTs = rs.getTimestamp("DATUM_IZRADE");
        OffsetDateTime createdAt = TimeUtil.oracleTimestampToZagreb(createdAtTs);

        Timestamp postedAtTs = rs.getTimestamp("DATUM_KNJIZENJA");
        OffsetDateTime postedAt = TimeUtil.oracleTimestampToZagreb(postedAtTs);

        Timestamp stornoAtTs = rs.getTimestamp("DATUM_STORNO");
        OffsetDateTime cancelledAt = TimeUtil.oracleTimestampToZagreb(stornoAtTs);

        Long id = rs.getLong("ID");
        if (rs.wasNull()) id = null;

        Long docId = rs.getLong("DOKUMENT_ID");
        if (rs.wasNull()) docId = null;
        Long docBr = rs.getLong("DOKUMENTBR");
        if (rs.wasNull()) docBr = null;
        Long partnerId = rs.getLong("PARTNER_ID");
        if (rs.wasNull()) partnerId = null;

        Long createdBy = rs.getLong("IZRADIO");
        if (rs.wasNull()) createdBy = null;
        Long postedBy = rs.getLong("KNJIZIO");
        if (rs.wasNull()) postedBy = null;
        Long cancelledBy = rs.getLong("STORNIRAO");
        if (rs.wasNull()) cancelledBy = null;

        boolean posted = (rs.getLong("KNJIZENO") == 1);

        String napomena;
        try {
            napomena = rs.getString("NAPOMENA");
        } catch (SQLException ignored) {
            napomena = null;
        }

        return DocumentHeaderEntity.builder()
                .id(id)
                .documentId(docId)
                .documentNumber(docBr)
                .documentDate(documentDate)
                .partnerId(partnerId)
                .createdBy(createdBy)
                .createdAt(createdAt)
                .posted(posted)
                .postedBy(postedBy)
                .postedAt(postedAt)
                .cancelledBy(cancelledBy)
                .cancelledAt(cancelledAt)
                .cancelNote(napomena)
                .build();
    }
}

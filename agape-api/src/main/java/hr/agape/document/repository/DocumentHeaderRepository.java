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

    public DocumentHeaderEntity insert(DocumentHeaderEntity h, boolean postNow) throws SQLException {
        try (Connection c = dataSource.getConnection()) {
            return doInsertHeader(c, h, postNow);
        }
    }

    private DocumentHeaderEntity doInsertHeader(Connection c, DocumentHeaderEntity h, boolean postNow)
            throws SQLException {

        final String sql = """
                INSERT INTO SD_GLAVA
                  (DOKUMENT_ID,
                   DATUM_DOKUMENTA,
                   PARTNER_ID,
                   IZRADIO,
                   DOKUMENTBR,
                   KNJIZENO,
                   KNJIZIO,
                   DATUM_KNJIZENJA)
                VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
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

            ops.setInt(5, postNow ? 1 : 0);

            if (postNow && h.getCreatedBy() != null) {
                ops.setLong(6, h.getCreatedBy());
            } else {
                ops.setNull(6, Types.NUMERIC);
            }

            if (postNow) {
                ops.setTimestamp(7, new Timestamp(System.currentTimeMillis()));
            } else {
                ops.setNull(7, Types.TIMESTAMP);
            }

            ops.registerReturnParameter(8, OracleTypes.NUMBER);     // ID
            ops.registerReturnParameter(9, OracleTypes.NUMBER);     // DOKUMENTBR
            ops.registerReturnParameter(10, OracleTypes.DATE);       // DATUM_DOKUMENTA
            ops.registerReturnParameter(11, OracleTypes.TIMESTAMP);  // DATUM_IZRADE
            ops.registerReturnParameter(12, OracleTypes.NUMBER);     // KNJIZENO
            ops.registerReturnParameter(13, OracleTypes.NUMBER);     // KNJIZIO
            ops.registerReturnParameter(14, OracleTypes.TIMESTAMP);  // DATUM_KNJIZENJA
            ops.registerReturnParameter(15, OracleTypes.NUMBER);     // STORNIRAO
            ops.registerReturnParameter(16, OracleTypes.TIMESTAMP);  // DATUM_STORNO
            ops.registerReturnParameter(17, OracleTypes.CLOB);       // NAPOMENA

            ops.executeUpdate();

            long id;
            Long documentNumber;
            LocalDate normalizedDocDate;
            OffsetDateTime createdAt;
            boolean posted;
            Long postedBy;
            OffsetDateTime postedAt;
            Long cancelledBy;
            OffsetDateTime cancelledAt;
            String cancelNote;

            try (ResultSet rs = ops.getReturnResultSet()) {
                rs.next();

                id = rs.getLong(1);

                long docNumTmp = rs.getLong(2);
                documentNumber = rs.wasNull() ? null : docNumTmp;

                Date dd = rs.getDate(3);
                normalizedDocDate = (dd != null ? dd.toLocalDate() : null);

                Timestamp tsCreated = rs.getTimestamp(4);
                createdAt = TimeUtil.oracleTimestampToZagreb(tsCreated);

                long knjizenoTmp = rs.getLong(5);
                posted = (knjizenoTmp == 1);

                long knjizioTmp = rs.getLong(6);
                postedBy = rs.wasNull() ? null : knjizioTmp;

                Timestamp tsPosted = rs.getTimestamp(7);
                postedAt = TimeUtil.oracleTimestampToZagreb(tsPosted);

                long stornoTmp = rs.getLong(8);
                cancelledBy = rs.wasNull() ? null : stornoTmp;

                Timestamp tsStorno = rs.getTimestamp(9);
                cancelledAt = TimeUtil.oracleTimestampToZagreb(tsStorno);

                cancelNote = rs.getString(10);
            }

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
                    .cancelNote(cancelNote)
                    .build();
        }
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

        inner.append("""
                     ORDER BY g.DATUM_DOKUMENTA DESC, g.ID DESC
                """);

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
                while (rs.next()) {
                    out.add(mapRowToEntity(rs));
                }
            }
        }

        return out;
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

    public DocumentHeaderEntity updateDraftHeader(
            Long headerId,
            Long partnerId,
            String note
    ) throws SQLException {

        final String sql = """
                    UPDATE SD_GLAVA
                       SET PARTNER_ID = COALESCE(?, PARTNER_ID),
                           NAPOMENA   = COALESCE(?, NAPOMENA)
                     WHERE ID = ?
                       AND KNJIZENO = 0
                       AND STORNIRAO IS NULL
                    RETURNING
                      ID,
                      DOKUMENT_ID,
                      DOKUMENTBR,
                      DATUM_DOKUMENTA,
                      PARTNER_ID,
                      IZRADIO,
                      DATUM_IZRADE,
                      KNJIZENO,
                      KNJIZIO,
                      DATUM_KNJIZENJA,
                      STORNIRAO,
                      DATUM_STORNO,
                      NAPOMENA
                    INTO ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                """;

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            OraclePreparedStatement ops = ps.unwrap(OraclePreparedStatement.class);

            if (partnerId != null) ops.setLong(1, partnerId);
            else ops.setNull(1, Types.NUMERIC);
            if (note != null) ops.setString(2, note);
            else ops.setNull(2, Types.CLOB);
            ops.setLong(3, headerId);

            ops.registerReturnParameter(4, OracleTypes.NUMBER);     // ID
            ops.registerReturnParameter(5, OracleTypes.NUMBER);     // DOKUMENT_ID
            ops.registerReturnParameter(6, OracleTypes.NUMBER);     // DOKUMENTBR
            ops.registerReturnParameter(7, OracleTypes.DATE);       // DATUM_DOKUMENTA
            ops.registerReturnParameter(8, OracleTypes.NUMBER);     // PARTNER_ID
            ops.registerReturnParameter(9, OracleTypes.NUMBER);     // IZRADIO
            ops.registerReturnParameter(10, OracleTypes.TIMESTAMP);  // DATUM_IZRADE
            ops.registerReturnParameter(11, OracleTypes.NUMBER);     // KNJIZENO
            ops.registerReturnParameter(12, OracleTypes.NUMBER);     // KNJIZIO
            ops.registerReturnParameter(13, OracleTypes.TIMESTAMP);  // DATUM_KNJIZENJA
            ops.registerReturnParameter(14, OracleTypes.NUMBER);     // STORNIRAO
            ops.registerReturnParameter(15, OracleTypes.TIMESTAMP);  // DATUM_STORNO
            ops.registerReturnParameter(16, OracleTypes.CLOB);       // NAPOMENA

            int updated = ops.executeUpdate();
            if (updated == 0) {
                return null;
            }

            try (ResultSet rs = ops.getReturnResultSet()) {
                rs.next();

                Long id = rs.getLong(1);
                Long docId = rs.getLong(2);
                if (rs.wasNull()) docId = null;
                Long docBr = rs.getLong(3);
                if (rs.wasNull()) docBr = null;

                Date dd = rs.getDate(4);
                LocalDate docDate = (dd != null ? dd.toLocalDate() : null);

                Long partner = rs.getLong(5);
                if (rs.wasNull()) partner = null;
                Long createdBy = rs.getLong(6);
                if (rs.wasNull()) createdBy = null;

                Timestamp tsCreated = rs.getTimestamp(7);
                OffsetDateTime createdAt = TimeUtil.oracleTimestampToZagreb(tsCreated);

                long knjizenoTmp = rs.getLong(8);
                Boolean posted = (knjizenoTmp == 1);

                Long knjizio = rs.getLong(9);
                if (rs.wasNull()) knjizio = null;
                Timestamp tsPost = rs.getTimestamp(10);
                OffsetDateTime postedAt = TimeUtil.oracleTimestampToZagreb(tsPost);

                Long stornoBy = rs.getLong(11);
                if (rs.wasNull()) stornoBy = null;
                Timestamp tsStorno = rs.getTimestamp(12);
                OffsetDateTime cancelledAt = TimeUtil.oracleTimestampToZagreb(tsStorno);

                String napomena = rs.getString(13);

                return DocumentHeaderEntity.builder()
                        .id(id)
                        .documentId(docId)
                        .documentNumber(docBr)
                        .documentDate(docDate)
                        .partnerId(partner)
                        .createdBy(createdBy)
                        .createdAt(createdAt)
                        .posted(posted)
                        .postedBy(knjizio)
                        .postedAt(postedAt)
                        .cancelledBy(stornoBy)
                        .cancelledAt(cancelledAt)
                        .cancelNote(napomena)
                        .build();
            }
        }
    }

    public DocumentHeaderEntity cancelDispatch(Long headerId, Long actorUserId, String reason) throws SQLException {
        final String sql = """
                    UPDATE SD_GLAVA
                       SET STORNIRAO     = ?,
                           DATUM_STORNO  = SYSDATE,
                           NAPOMENA      = ?
                     WHERE ID = ?
                       AND KNJIZENO = 1
                       AND STORNIRAO IS NULL
                    RETURNING
                      ID,
                      DOKUMENT_ID,
                      DOKUMENTBR,
                      DATUM_DOKUMENTA,
                      PARTNER_ID,
                      IZRADIO,
                      DATUM_IZRADE,
                      KNJIZENO,
                      KNJIZIO,
                      DATUM_KNJIZENJA,
                      STORNIRAO,
                      DATUM_STORNO,
                      NAPOMENA
                    INTO ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                """;

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            OraclePreparedStatement ops = ps.unwrap(OraclePreparedStatement.class);

            if (actorUserId != null) ops.setLong(1, actorUserId);
            else ops.setNull(1, Types.NUMERIC);
            if (reason != null) ops.setString(2, reason);
            else ops.setNull(2, Types.CLOB);
            ops.setLong(3, headerId);

            ops.registerReturnParameter(4, OracleTypes.NUMBER);     // ID
            ops.registerReturnParameter(5, OracleTypes.NUMBER);     // DOKUMENT_ID
            ops.registerReturnParameter(6, OracleTypes.NUMBER);     // DOKUMENTBR
            ops.registerReturnParameter(7, OracleTypes.DATE);       // DATUM_DOKUMENTA
            ops.registerReturnParameter(8, OracleTypes.NUMBER);     // PARTNER_ID
            ops.registerReturnParameter(9, OracleTypes.NUMBER);     // IZRADIO
            ops.registerReturnParameter(10, OracleTypes.TIMESTAMP);  // DATUM_IZRADE
            ops.registerReturnParameter(11, OracleTypes.NUMBER);     // KNJIZENO
            ops.registerReturnParameter(12, OracleTypes.NUMBER);     // KNJIZIO
            ops.registerReturnParameter(13, OracleTypes.TIMESTAMP);  // DATUM_KNJIZENJA
            ops.registerReturnParameter(14, OracleTypes.NUMBER);     // STORNIRAO
            ops.registerReturnParameter(15, OracleTypes.TIMESTAMP);  // DATUM_STORNO
            ops.registerReturnParameter(16, OracleTypes.CLOB);       // NAPOMENA

            int updated = ops.executeUpdate();
            if (updated == 0) {
                return null;
            }

            try (ResultSet rs = ops.getReturnResultSet()) {
                rs.next();

                Long id = rs.getLong(1);
                Long docId = rs.getLong(2);
                if (rs.wasNull()) docId = null;
                Long docBr = rs.getLong(3);
                if (rs.wasNull()) docBr = null;

                Date dd = rs.getDate(4);
                LocalDate docDate = (dd != null ? dd.toLocalDate() : null);

                Long partner = rs.getLong(5);
                if (rs.wasNull()) partner = null;
                Long createdBy = rs.getLong(6);
                if (rs.wasNull()) createdBy = null;

                Timestamp tsCreated = rs.getTimestamp(7);
                OffsetDateTime createdAt = TimeUtil.oracleTimestampToZagreb(tsCreated);

                long knjizenoTmp = rs.getLong(8);
                Boolean posted = (knjizenoTmp == 1);

                Long knjizio = rs.getLong(9);
                if (rs.wasNull()) knjizio = null;
                Timestamp tsPost = rs.getTimestamp(10);
                OffsetDateTime postedAt = TimeUtil.oracleTimestampToZagreb(tsPost);

                Long stornoBy = rs.getLong(11);
                if (rs.wasNull()) stornoBy = null;
                Timestamp tsStorno = rs.getTimestamp(12);
                OffsetDateTime cancelledAt = TimeUtil.oracleTimestampToZagreb(tsStorno);

                String napomena = rs.getString(13);

                return DocumentHeaderEntity.builder()
                        .id(id)
                        .documentId(docId)
                        .documentNumber(docBr)
                        .documentDate(docDate)
                        .partnerId(partner)
                        .createdBy(createdBy)
                        .createdAt(createdAt)
                        .posted(posted)
                        .postedBy(knjizio)
                        .postedAt(postedAt)
                        .cancelledBy(stornoBy)
                        .cancelledAt(cancelledAt)
                        .cancelNote(napomena)
                        .build();
            }
        }
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
            switch (val) {
                case Long v -> ps.setLong(i++, v);
                case Integer v -> ps.setInt(i++, v);
                case Date v -> ps.setDate(i++, v);
                case null, default -> ps.setObject(i++, val);
            }
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

        Long id = null;
        long idTmp = rs.getLong("ID");
        if (!rs.wasNull()) id = idTmp;

        Long docId = null;
        long docIdTmp = rs.getLong("DOKUMENT_ID");
        if (!rs.wasNull()) docId = docIdTmp;

        Long docBr = null;
        long docBrTmp = rs.getLong("DOKUMENTBR");
        if (!rs.wasNull()) docBr = docBrTmp;

        Long partnerId = null;
        long partnerIdTmp = rs.getLong("PARTNER_ID");
        if (!rs.wasNull()) partnerId = partnerIdTmp;

        Long createdBy = null;
        long createdByTmp = rs.getLong("IZRADIO");
        if (!rs.wasNull()) createdBy = createdByTmp;

        Long postedBy = null;
        long postedByTmp = rs.getLong("KNJIZIO");
        if (!rs.wasNull()) postedBy = postedByTmp;

        Long cancelledBy = null;
        long cancelledByTmp = rs.getLong("STORNIRAO");
        if (!rs.wasNull()) cancelledBy = cancelledByTmp;

        Long knjizenoTmp = null;
        long knjizenoLong = rs.getLong("KNJIZENO");
        if (!rs.wasNull()) knjizenoTmp = knjizenoLong;
        Boolean posted = (knjizenoTmp != null && knjizenoTmp == 1L);

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

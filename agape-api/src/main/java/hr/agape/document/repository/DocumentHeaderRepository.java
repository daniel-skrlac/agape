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

    public DocumentHeaderEntity insert(DocumentHeaderEntity h) throws SQLException {
        try (Connection c = dataSource.getConnection()) {
            return doInsertHeader(c, h);
        }
    }

    public List<DocumentHeaderEntity> insertAll(List<DocumentHeaderEntity> headers) throws SQLException {
        List<DocumentHeaderEntity> out = new ArrayList<>(headers.size());
        try (Connection c = dataSource.getConnection()) {
            for (DocumentHeaderEntity h : headers) {
                out.add(doInsertHeader(c, h));
            }
        }
        return out;
    }

    private DocumentHeaderEntity doInsertHeader(Connection c, DocumentHeaderEntity h) throws SQLException {
        final String sql =
                "INSERT INTO SD_GLAVA " +
                        " (DOKUMENT_ID, DATUM_DOKUMENTA, PARTNER_ID, IZRADIO, DOKUMENTBR) " +
                        " VALUES (?, ?, ?, ?, NULL) " +
                        " RETURNING ID, DOKUMENTBR, DATUM_DOKUMENTA, DATUM_IZRADE " +
                        " INTO ?, ?, ?, ?";

        try (PreparedStatement ps = c.prepareStatement(sql)) {
            OraclePreparedStatement ops = ps.unwrap(OraclePreparedStatement.class);

            if (h.getDocumentId() != null) {
                ops.setLong(1, h.getDocumentId());
            } else {
                ops.setNull(1, Types.NUMERIC);
            }

            if (h.getDocumentDate() != null) {
                ops.setDate(2, Date.valueOf(h.getDocumentDate()));
            } else {
                ops.setNull(2, Types.DATE);
            }

            if (h.getPartnerId() != null) {
                ops.setLong(3, h.getPartnerId());
            } else {
                ops.setNull(3, Types.NUMERIC);
            }

            if (h.getCreatedBy() != null) {
                ops.setLong(4, h.getCreatedBy());
            } else {
                ops.setNull(4, Types.NUMERIC);
            }

            ops.registerReturnParameter(5, OracleTypes.NUMBER);
            ops.registerReturnParameter(6, OracleTypes.NUMBER);
            ops.registerReturnParameter(7, OracleTypes.DATE);
            ops.registerReturnParameter(8, OracleTypes.TIMESTAMP);

            ops.executeUpdate();

            long id;
            Long docNum;
            LocalDate normalizedDocDate;
            OffsetDateTime createdAt;

            try (ResultSet rs = ops.getReturnResultSet()) {
                rs.next();

                id = rs.getLong(1);

                long tmpDocNum = rs.getLong(2);
                docNum = rs.wasNull() ? null : tmpDocNum;

                Date d = rs.getDate(3);
                normalizedDocDate = (d != null ? d.toLocalDate() : null);

                Timestamp ts = rs.getTimestamp(4);
                createdAt = TimeUtil.oracleTimestampToZagreb(ts);
            }

            return DocumentHeaderEntity.builder()
                    .id(id)
                    .documentId(h.getDocumentId())
                    .documentNumber(docNum)
                    .documentDate(normalizedDocDate)
                    .partnerId(h.getPartnerId())
                    .createdBy(h.getCreatedBy())
                    .createdAt(createdAt)
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
                        g.DATUM_IZRADE
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
                    Date sqlDate = rs.getDate("DATUM_DOKUMENTA");
                    LocalDate documentDate = (sqlDate != null ? sqlDate.toLocalDate() : null);

                    Timestamp createdAtTs = rs.getTimestamp("DATUM_IZRADE");
                    OffsetDateTime createdAt = TimeUtil.oracleTimestampToZagreb(createdAtTs);

                    long docIdRaw = rs.getLong("DOKUMENT_ID");
                    Long documentId = rs.wasNull() ? null : docIdRaw;

                    long docNumRaw = rs.getLong("DOKUMENTBR");
                    Long documentNumber = rs.wasNull() ? null : docNumRaw;

                    long partnerRaw = rs.getLong("PARTNER_ID");
                    Long partnerId = rs.wasNull() ? null : partnerRaw;

                    long createdByRaw = rs.getLong("IZRADIO");
                    Long createdBy = rs.wasNull() ? null : createdByRaw;

                    out.add(
                            DocumentHeaderEntity.builder()
                                    .id(rs.getLong("ID"))
                                    .documentId(documentId)
                                    .documentNumber(documentNumber)
                                    .documentDate(documentDate)
                                    .partnerId(partnerId)
                                    .createdBy(createdBy)
                                    .createdAt(createdAt)
                                    .build()
                    );
                }
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
            switch (val) {
                case Integer v -> ps.setInt(i, v);
                case Long v -> ps.setLong(i, v);
                case Date v -> ps.setDate(i, v);
                default -> ps.setObject(i, val);
            }
            i++;
        }
        return i;
    }
}

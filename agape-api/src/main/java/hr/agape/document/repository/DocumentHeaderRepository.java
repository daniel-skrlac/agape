package hr.agape.document.repository;

import hr.agape.document.domain.DocumentHeaderEntity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import oracle.jdbc.OraclePreparedStatement;
import oracle.jdbc.OracleTypes;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

//SD_GLAVA
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
                        " RETURNING ID, DOKUMENTBR, DATUM_DOKUMENTA INTO ?, ?, ?";

        try (PreparedStatement ps = c.prepareStatement(sql)) {
            var ops = ps.unwrap(OraclePreparedStatement.class);

            if (h.getDocumentId() != null) ops.setInt(1, h.getDocumentId());
            else ops.setNull(1, Types.INTEGER);
            if (h.getDocumentDate() != null) ops.setDate(2, Date.valueOf(h.getDocumentDate()));
            else ops.setNull(2, Types.DATE);
            if (h.getPartnerId() != null) ops.setInt(3, h.getPartnerId());
            else ops.setNull(3, Types.INTEGER);
            if (h.getCreatedBy() != null) ops.setInt(4, h.getCreatedBy());
            else ops.setNull(4, Types.INTEGER);

            ops.registerReturnParameter(5, OracleTypes.NUMBER);
            ops.registerReturnParameter(6, OracleTypes.NUMBER);
            ops.registerReturnParameter(7, OracleTypes.DATE);

            ops.executeUpdate();

            long id;
            int docNum;
            LocalDate date;
            try (var rs = ops.getReturnResultSet()) {
                rs.next();
                id = rs.getLong(1);
                docNum = rs.getInt(2);
                var d = rs.getDate(3);
                date = (d != null ? d.toLocalDate() : null);
            }

            return DocumentHeaderEntity.builder()
                    .id(id)
                    .documentId(h.getDocumentId())
                    .documentNumber(docNum)
                    .documentDate(date)
                    .partnerId(h.getPartnerId())
                    .createdBy(h.getCreatedBy())
                    .build();
        }
    }
}

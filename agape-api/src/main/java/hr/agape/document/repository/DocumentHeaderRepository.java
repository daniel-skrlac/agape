package hr.agape.document.repository;

import hr.agape.document.domain.DocumentHeader;
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
import java.sql.Types;
import java.time.LocalDate;
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

    public DocumentHeader insert(DocumentHeader h) throws SQLException {
        try (Connection c = dataSource.getConnection()) {
            return doInsertHeader(c, h);
        }
    }

    public List<DocumentHeader> insertAll(List<DocumentHeader> headers) throws SQLException {
        List<DocumentHeader> out = new ArrayList<>(headers.size());
        try (Connection c = dataSource.getConnection()) {
            for (DocumentHeader h : headers) {
                out.add(doInsertHeader(c, h));
            }
        }
        return out;
    }

    private DocumentHeader doInsertHeader(Connection c, DocumentHeader h) throws SQLException {
        final String sql =
                "INSERT INTO SD_GLAVA " +
                        " (DOKUMENT_ID, DATUM_DOKUMENTA, PARTNER_ID, BROJOTPREMNICE, DOKUMENTBR) " +
                        " VALUES (?, ?, ?, ?, NULL) " +
                        " RETURNING ID, DOKUMENTBR, DATUM_DOKUMENTA INTO ?, ?, ?";

        try (PreparedStatement ps0 = c.prepareStatement(sql)) {
            OraclePreparedStatement ps = (OraclePreparedStatement) ps0;

            ps.setObject(1, h.getDocumentId(), Types.INTEGER);
            if (h.getDocumentDate() != null) ps.setDate(2, Date.valueOf(h.getDocumentDate()));
            else ps.setNull(2, Types.DATE);
            ps.setObject(3, h.getPartnerId(), Types.INTEGER);
            if (h.getDispatchNumber() != null) ps.setString(4, h.getDispatchNumber());
            else ps.setNull(4, Types.VARCHAR);

            ps.registerReturnParameter(5, OracleTypes.NUMBER);
            ps.registerReturnParameter(6, OracleTypes.NUMBER);
            ps.registerReturnParameter(7, OracleTypes.DATE);

            ps.executeUpdate();

            long id;
            int documentNmbr;
            LocalDate date;
            try (ResultSet rs = ps.getReturnResultSet()) {
                rs.next();
                id = rs.getLong(1);
                documentNmbr = rs.getInt(2);
                Date d = rs.getDate(3);
                date = (d != null ? d.toLocalDate() : null);
            }

            return DocumentHeader.builder()
                    .id(id)
                    .documentId(h.getDocumentId())
                    .documentNumber(documentNmbr)
                    .documentDate(date)
                    .partnerId(h.getPartnerId())
                    .dispatchNumber(h.getDispatchNumber())
                    .build();
        }
    }
}

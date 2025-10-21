package agapi.document.repository;

import agapi.document.domain.DocumentHeader;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import io.smallrye.common.annotation.Blocking;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;

@ApplicationScoped
public class DocumentHeaderRepository {

    private final DataSource dataSource;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public DocumentHeaderRepository(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    /**
     * Obtain next value from SD_GLAVA_SEQ.
     */
    public long nextId(Connection c) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT SD_GLAVA_SEQ.NEXTVAL FROM dual");
             ResultSet rs = ps.executeQuery()) {
            rs.next();
            return rs.getLong(1);
        }
    }

    /**
     * Inserts SD_GLAVA with an explicit ID (sequence), leaving DOKUMENTBR null
     * so trigger SD_GLAVA_BIU assigns it. Returns the inserted header with
     * final (documentNumber, documentDate).
     */
    @Blocking
    public DocumentHeader insert(DocumentHeader header) throws SQLException {
        try (Connection c = dataSource.getConnection()) {
            c.setAutoCommit(false);
            try {
                long id = nextId(c);

                try (PreparedStatement ps = c.prepareStatement(
                        "INSERT INTO SD_GLAVA " +
                                " (ID, DOKUMENT_ID, DATUM_DOKUMENTA, PARTNER_ID, BROJOTPREMNICE, DOKUMENTBR) " +
                                " VALUES (?, ?, ?, ?, ?, NULL)")) {
                    ps.setLong(1, id);
                    ps.setObject(2, header.getDocumentId(), Types.INTEGER);
                    if (header.getDocumentDate() != null) {
                        ps.setDate(3, Date.valueOf(header.getDocumentDate()));
                    } else {
                        ps.setNull(3, Types.DATE);
                    }
                    ps.setObject(4, header.getPartnerId(), Types.INTEGER);
                    if (header.getDispatchNumber() != null) {
                        ps.setString(5, header.getDispatchNumber());
                    } else {
                        ps.setNull(5, Types.VARCHAR);
                    }
                    ps.executeUpdate();
                }

                DocumentHeader out;
                try (PreparedStatement ps = c.prepareStatement(
                        "SELECT ID, DOKUMENT_ID, DOKUMENTBR, DATUM_DOKUMENTA, PARTNER_ID, BROJOTPREMNICE " +
                                "FROM SD_GLAVA WHERE ID = ?")) {
                    ps.setLong(1, id);
                    try (ResultSet rs = ps.executeQuery()) {
                        rs.next();
                        out = DocumentHeader.builder()
                                .id(rs.getLong("ID"))
                                .documentId(rs.getInt("DOKUMENT_ID"))
                                .documentNumber(rs.getInt("DOKUMENTBR"))
                                .documentDate(rs.getDate("DATUM_DOKUMENTA") != null
                                        ? rs.getDate("DATUM_DOKUMENTA").toLocalDate()
                                        : null)
                                .partnerId(rs.getInt("PARTNER_ID"))
                                .dispatchNumber(rs.getString("BROJOTPREMNICE"))
                                .build();
                    }
                }

                c.commit();
                return out;
            } catch (SQLException e) {
                c.rollback();
                throw e;
            }
        }
    }
}

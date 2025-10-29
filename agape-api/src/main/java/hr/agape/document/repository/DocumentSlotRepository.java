package hr.agape.document.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

//SD_SIFREG
@ApplicationScoped
public class DocumentSlotRepository {

    private final DataSource dataSource;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public DocumentSlotRepository(@io.quarkus.agroal.DataSource("oracle") DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public boolean existsForWarehouse(Long documentId, Long warehouseId) throws SQLException {
        final String sql = """
                SELECT 1
                  FROM SD_SIFREG
                 WHERE DOKUMENT_ID = ?
                   AND SKLADISTE_ID = ?
                   AND ROWNUM = 1
                """;

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            ps.setLong(1, documentId);
            ps.setLong(2, warehouseId);

            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    public Long warehouseForDocument(Long documentId) throws SQLException {
        final String sql = """
                SELECT SKLADISTE_ID
                  FROM SD_SIFREG
                 WHERE DOKUMENT_ID = ?
                   AND ROWNUM = 1
                """;

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            ps.setLong(1, documentId);

            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                long whRaw = rs.getLong("SKLADISTE_ID");
                return rs.wasNull() ? null : whRaw;
            }
        }
    }
}

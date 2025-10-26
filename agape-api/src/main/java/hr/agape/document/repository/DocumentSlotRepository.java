package hr.agape.document.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

//SD_SIFREZ
@ApplicationScoped
public class DocumentSlotRepository {

    private final DataSource dataSource;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public DocumentSlotRepository(@io.quarkus.agroal.DataSource("oracle") DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public boolean existsForWarehouse(int documentId, int warehouseId) throws SQLException {
        final String sql = """
                SELECT 1
                  FROM SD_SIFREG
                 WHERE DOKUMENT_ID = ?
                   AND SKLADISTE_ID = ?
                   AND ROWNUM = 1
                """;

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            ps.setInt(1, documentId);
            ps.setInt(2, warehouseId);

            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }
}
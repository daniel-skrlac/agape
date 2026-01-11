package hr.agape.document.repository;

import hr.agape.common.database.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.sql.SQLException;

//SD_SIFREG
@ApplicationScoped
public class DocumentSlotRepository {

    private final Jdbc jdbc;

    @Inject
    public DocumentSlotRepository(Jdbc jdbc) {
        this.jdbc = jdbc;
    }

    public boolean existsForWarehouse(Long documentId, Long warehouseId) throws SQLException {
        final String sql = """
                SELECT 1
                  FROM SD_SIFREG
                 WHERE DOKUMENT_ID = ?
                   AND SKLADISTE_ID = ?
                   AND ROWNUM = 1
                """;

        Integer one = jdbc.queryOne(
                sql,
                ps -> {
                    ps.setLong(1, documentId);
                    ps.setLong(2, warehouseId);
                },
                rs -> rs.getInt(1)
        );

        return one != null;
    }

    public Long warehouseForDocument(Long documentId) throws SQLException {
        final String sql = """
                SELECT SKLADISTE_ID
                  FROM SD_SIFREG
                 WHERE DOKUMENT_ID = ?
                   AND ROWNUM = 1
                """;

        return jdbc.queryOne(
                sql,
                ps -> ps.setLong(1, documentId),
                rs -> {
                    long whRaw = rs.getLong("SKLADISTE_ID");
                    return rs.wasNull() ? null : whRaw;
                }
        );
    }
}

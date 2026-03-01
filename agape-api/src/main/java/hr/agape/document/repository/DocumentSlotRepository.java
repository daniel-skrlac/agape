package hr.agape.document.repository;

import hr.agape.common.database.Jdbc;
import hr.agape.dispatch.enumeration.DocumentTextType;
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

    /**
     * SD_SIFREZ lookup: find ID by DOKUMENTID code (e.g. 'OTPREMNICA').
     */
    public Long resolveSifrezIdByDokumentKod(String dokumentKod) throws SQLException {
        final String sql = """
                SELECT SD_SIFREZ_ID
                  FROM SD_SIFREZ
                 WHERE DOKUMENTID = ?
                   AND ROWNUM = 1
                """;

        return jdbc.queryOne(
                sql,
                ps -> ps.setString(1, dokumentKod),
                rs -> {
                    long v = rs.getLong(1);
                    return rs.wasNull() ? null : v;
                }
        );
    }

    /**
     * SD_SIFREG lookup: find DOKUMENT_ID by (SD_SIFREZ_ID, SKLADISTE_ID).
     */
    public Long resolveDocumentIdForWarehouseAndSifrez(Long warehouseId, Long sdSifrezId) throws SQLException {
        final String sql = """
                SELECT DOKUMENT_ID
                  FROM SD_SIFREG
                 WHERE SD_SIFREZ_ID = ?
                   AND SKLADISTE_ID = ?
                   AND ROWNUM = 1
                """;

        return jdbc.queryOne(
                sql,
                ps -> {
                    ps.setLong(1, sdSifrezId);
                    ps.setLong(2, warehouseId);
                },
                rs -> {
                    long v = rs.getLong(1);
                    return rs.wasNull() ? null : v;
                }
        );
    }

    /**
     * Convenience: resolve dispatch documentId for a warehouse.
     * Uses SD_SIFREZ where DOKUMENTID='OTPREMNICA'.
     */
    public Long resolveDispatchDocumentIdForWarehouse(Long warehouseId) throws SQLException {
        Long sifrezId = resolveSifrezIdByDokumentKod(DocumentTextType.OTPREMNICA.dbValue());
        if (sifrezId == null) return null;
        return resolveDocumentIdForWarehouseAndSifrez(warehouseId, sifrezId);
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

package hr.agape.document.repository;

import hr.agape.common.database.Jdbc;
import hr.agape.dispatch.enumeration.DocumentTextType;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.sql.SQLException;
import java.util.List;

@ApplicationScoped
public class DocumentSlotRepository {

    private final Jdbc jdbc;

    @Inject
    public DocumentSlotRepository(Jdbc jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Correct resolver for dispatch booking.
     * <p>
     * DOKUMENT_ID must be resolved directly from selected SKLADISTE_ID + document code.
     * Do not resolve SD_SIFREZ_ID first with ROWNUM = 1, because OTPREMNICA exists
     * in multiple SD_SIFREZ rows.
     */
    public Long resolveDocumentIdForWarehouseAndCode(Long warehouseId, String documentCode) throws SQLException {
        if (warehouseId == null || documentCode == null || documentCode.isBlank()) {
            return null;
        }

        final String sql = """
                SELECT r.DOKUMENT_ID
                  FROM SD_SIFREG r
                  JOIN SD_SIFREZ z
                    ON z.SD_SIFREZ_ID = r.SD_SIFREZ_ID
                 WHERE r.SKLADISTE_ID = ?
                   AND TRIM(UPPER(z.DOKUMENTID)) = TRIM(UPPER(?))
                 ORDER BY r.DOKUMENT_ID
                """;

        List<Long> matches = jdbc.query(
                sql,
                ps -> {
                    ps.setLong(1, warehouseId);
                    ps.setString(2, documentCode);
                },
                rs -> {
                    long value = rs.getLong("DOKUMENT_ID");
                    return rs.wasNull() ? null : value;
                }
        );

        return requireUniqueMatch(matches, warehouseId, documentCode);
    }

    public Long resolveDispatchDocumentIdForWarehouse(Long warehouseId) throws SQLException {
        return resolveDocumentIdForWarehouseAndCode(
                warehouseId,
                DocumentTextType.OTPREMNICA.dbValue()
        );
    }

    @Deprecated
    public Long resolveSifrezIdByDokumentKod(String dokumentKod) throws SQLException {
        if (dokumentKod == null || dokumentKod.isBlank()) {
            return null;
        }

        final String sql = """
                SELECT SD_SIFREZ_ID
                  FROM SD_SIFREZ
                 WHERE TRIM(UPPER(DOKUMENTID)) = TRIM(UPPER(?))
                 ORDER BY SD_SIFREZ_ID
                """;

        List<Long> matches = jdbc.query(
                sql,
                ps -> ps.setString(1, dokumentKod),
                rs -> {
                    long value = rs.getLong("SD_SIFREZ_ID");
                    return rs.wasNull() ? null : value;
                }
        );

        if (matches.size() > 1) {
            throw new SQLException("Ambiguous legacy document type code=" + dokumentKod + ". Use warehouse-specific resolution.");
        }
        return matches.isEmpty() ? null : matches.getFirst();
    }

    @Deprecated
    public Long resolveDocumentIdForWarehouseAndSifrez(Long warehouseId, Long sdSifrezId) throws SQLException {
        if (warehouseId == null || sdSifrezId == null) {
            return null;
        }

        final String sql = """
                SELECT DOKUMENT_ID
                  FROM SD_SIFREG
                 WHERE SD_SIFREZ_ID = ?
                   AND SKLADISTE_ID = ?
                """;

        return jdbc.queryOne(
                sql,
                ps -> {
                    ps.setLong(1, sdSifrezId);
                    ps.setLong(2, warehouseId);
                },
                rs -> {
                    long value = rs.getLong("DOKUMENT_ID");
                    return rs.wasNull() ? null : value;
                }
        );
    }

    public boolean existsForWarehouse(Long documentId, Long warehouseId) throws SQLException {
        if (documentId == null || warehouseId == null) {
            return false;
        }

        final String sql = """
                SELECT COUNT(*)
                  FROM SD_SIFREG
                 WHERE DOKUMENT_ID = ?
                   AND SKLADISTE_ID = ?
                """;

        Integer exists = jdbc.queryOne(
                sql,
                ps -> {
                    ps.setLong(1, documentId);
                    ps.setLong(2, warehouseId);
                },
                rs -> rs.getInt(1)
        );

        return exists != null && exists == 1;
    }

    public Long warehouseForDocument(Long documentId) throws SQLException {
        if (documentId == null) {
            return null;
        }

        final String sql = """
                SELECT SKLADISTE_ID
                  FROM SD_SIFREG
                 WHERE DOKUMENT_ID = ?
                """;

        return jdbc.queryOne(
                sql,
                ps -> ps.setLong(1, documentId),
                rs -> {
                    long value = rs.getLong("SKLADISTE_ID");
                    return rs.wasNull() ? null : value;
                }
        );
    }

    private Long requireUniqueMatch(List<Long> matches, Long warehouseId, String documentCode) throws SQLException {
        List<Long> resolved = matches == null
                ? List.of()
                : matches.stream().filter(value -> value != null).distinct().toList();

        if (resolved.size() > 1) {
            throw new SQLException(
                    "Ambiguous legacy document mapping for warehouseId=" + warehouseId
                            + ", documentCode=" + documentCode
                            + ": DOKUMENT_ID values=" + resolved
            );
        }

        return resolved.isEmpty() ? null : resolved.getFirst();
    }
}

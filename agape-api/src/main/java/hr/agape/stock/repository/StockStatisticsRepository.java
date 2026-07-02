package hr.agape.stock.repository;

import hr.agape.common.database.Jdbc;
import hr.agape.stock.domain.StockItemStatus;
import hr.agape.stock.dto.StockStatisticsTotalsDTO;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

@ApplicationScoped
public class StockStatisticsRepository {

    private static final String DEFAULT_DOCUMENT_CODE = "OTPREMNICA";

    private final Jdbc jdbc;

    @Inject
    public StockStatisticsRepository(Jdbc jdbc) {
        this.jdbc = jdbc;
    }

    public List<Integer> listAvailableYears(String documentCode, Long warehouseId, Long storageGroupId) throws SQLException {
        final String sql = """
                SELECT DISTINCT EXTRACT(YEAR FROM g.DATUM_DOKUMENTA) AS DOC_YEAR
                  FROM SD_GLAVA g
                  JOIN SD_SIFREG r ON r.DOKUMENT_ID = g.DOKUMENT_ID
                  JOIN SD_SIFREZ z ON z.SD_SIFREZ_ID = r.SD_SIFREZ_ID
                 WHERE TRIM(UPPER(z.DOKUMENTID)) = TRIM(UPPER(?))
                   AND g.DATUM_DOKUMENTA IS NOT NULL
                   AND NVL(g.KNJIZENO, 0) = 1
                   AND NVL(g.STORNO, 0) = 0
                   AND g.DATUM_STORNO IS NULL
                   AND g.STORNIRAO IS NULL
                   AND (? IS NULL OR r.SKLADISTE_ID = ?)
                   AND (? IS NULL OR z.SKL_SIFREZ_ID = ?)
                 ORDER BY DOC_YEAR DESC
                """;

        return jdbc.query(
                sql,
                ps -> {
                    int i = 1;
                    ps.setString(i++, effectiveDocumentCode(documentCode));
                    ps.setObject(i++, warehouseId);
                    ps.setObject(i++, warehouseId);
                    ps.setObject(i++, storageGroupId);
                    ps.setObject(i++, storageGroupId);
                },
                rs -> rs.getInt("DOC_YEAR")
        );
    }

    /**
     * Missing = item exists in eligible warehouse catalog, but has no stock row
     * or current quantity is null/zero/negative.
     */
    public List<StockItemStatus> findMissing(
            Long warehouseId,
            Long storageGroupId,
            Integer documentYear,
            String documentCode
    ) throws SQLException {
        StringBuilder sql = baseSelect();
        sql.append("""
                AND (
                      a.ARTIKL_ID IS NULL
                   OR a.ZALIHATRENUTNA IS NULL
                   OR a.ZALIHATRENUTNA <= 0
                )
                ORDER BY n.NAZIV ASC NULLS LAST, z.ARTIKLID ASC
                )
                """);

        return queryItems(sql.toString(), warehouseId, storageGroupId, documentYear, documentCode);
    }

    /**
     * Needs fill = current > 0 and current < minimal.
     */
    public List<StockItemStatus> findNeedsFill(
            Long warehouseId,
            Long storageGroupId,
            Integer documentYear,
            String documentCode
    ) throws SQLException {
        StringBuilder sql = baseSelect();
        sql.append("""
                AND a.ZALIHATRENUTNA IS NOT NULL
                AND a.ZALIHATRENUTNA > 0
                AND a.ZALIHAMINIMALNA IS NOT NULL
                AND a.ZALIHAMINIMALNA > 0
                AND a.ZALIHATRENUTNA < a.ZALIHAMINIMALNA
                ORDER BY (a.ZALIHATRENUTNA / a.ZALIHAMINIMALNA) ASC NULLS FIRST, n.NAZIV ASC NULLS LAST
                )
                """);

        return queryItems(sql.toString(), warehouseId, storageGroupId, documentYear, documentCode);
    }

    /**
     * Most in stock = show only items that actually have stock (> 0).
     */
    public List<StockItemStatus> findMostInStock(
            Long warehouseId,
            Long storageGroupId,
            Integer documentYear,
            String documentCode
    ) throws SQLException {
        StringBuilder sql = baseSelect();
        sql.append("""
                AND a.ZALIHATRENUTNA IS NOT NULL
                AND a.ZALIHATRENUTNA > 0
                ORDER BY a.ZALIHATRENUTNA DESC, n.NAZIV ASC NULLS LAST
                )
                """);

        return queryItems(sql.toString(), warehouseId, storageGroupId, documentYear, documentCode);
    }

    public StockStatisticsTotalsDTO loadTotals(
            Long warehouseId,
            Long storageGroupId,
            Integer documentYear,
            String documentCode
    ) throws SQLException {
        Long totalItems = queryLong("""
                SELECT COUNT(*)
                  FROM SKL_ARTIKLIG g
                  JOIN eligible_warehouses ew ON ew.SKLADISTE_ID = g.SKLADISTE_ID
                 WHERE NVL(g.AKTIVANARTIKL, 1) = 1
                """, warehouseId, storageGroupId, documentYear, documentCode);

        Long missingCount = queryLong("""
                SELECT COUNT(*)
                  FROM SKL_ARTIKLIG g
                  JOIN eligible_warehouses ew ON ew.SKLADISTE_ID = g.SKLADISTE_ID
                  LEFT JOIN SKL_APROMETI a ON a.ARTIKL_ID = g.ARTIKL_ID
                 WHERE NVL(g.AKTIVANARTIKL, 1) = 1
                   AND (
                         a.ARTIKL_ID IS NULL
                      OR a.ZALIHATRENUTNA IS NULL
                      OR a.ZALIHATRENUTNA <= 0
                   )
                """, warehouseId, storageGroupId, documentYear, documentCode);

        Long needsFillCount = queryLong("""
                SELECT COUNT(*)
                  FROM SKL_ARTIKLIG g
                  JOIN eligible_warehouses ew ON ew.SKLADISTE_ID = g.SKLADISTE_ID
                  JOIN SKL_APROMETI a ON a.ARTIKL_ID = g.ARTIKL_ID
                 WHERE NVL(g.AKTIVANARTIKL, 1) = 1
                   AND a.ZALIHATRENUTNA IS NOT NULL
                   AND a.ZALIHATRENUTNA > 0
                   AND a.ZALIHAMINIMALNA IS NOT NULL
                   AND a.ZALIHAMINIMALNA > 0
                   AND a.ZALIHATRENUTNA < a.ZALIHAMINIMALNA
                """, warehouseId, storageGroupId, documentYear, documentCode);

        Long overstockedCount = queryLong("""
                SELECT COUNT(*)
                  FROM SKL_ARTIKLIG g
                  JOIN eligible_warehouses ew ON ew.SKLADISTE_ID = g.SKLADISTE_ID
                  JOIN SKL_APROMETI a ON a.ARTIKL_ID = g.ARTIKL_ID
                 WHERE NVL(g.AKTIVANARTIKL, 1) = 1
                   AND a.ZALIHATRENUTNA IS NOT NULL
                   AND a.ZALIHAPREPORUCENA IS NOT NULL
                   AND a.ZALIHATRENUTNA > a.ZALIHAPREPORUCENA
                """, warehouseId, storageGroupId, documentYear, documentCode);

        Long reservedCount = queryLong("""
                SELECT COUNT(*)
                  FROM SKL_ARTIKLIG g
                  JOIN eligible_warehouses ew ON ew.SKLADISTE_ID = g.SKLADISTE_ID
                  JOIN SKL_APROMETI a ON a.ARTIKL_ID = g.ARTIKL_ID
                 WHERE NVL(g.AKTIVANARTIKL, 1) = 1
                   AND a.ZALIHAREZERVIRANA IS NOT NULL
                   AND a.ZALIHAREZERVIRANA > 0
                """, warehouseId, storageGroupId, documentYear, documentCode);

        BigDecimal totalStockQty = queryDecimal("""
                SELECT NVL(SUM(NVL(a.ZALIHATRENUTNA, 0)), 0)
                  FROM SKL_ARTIKLIG g
                  JOIN eligible_warehouses ew ON ew.SKLADISTE_ID = g.SKLADISTE_ID
                  LEFT JOIN SKL_APROMETI a ON a.ARTIKL_ID = g.ARTIKL_ID
                 WHERE NVL(g.AKTIVANARTIKL, 1) = 1
                """, warehouseId, storageGroupId, documentYear, documentCode);

        return StockStatisticsTotalsDTO.builder()
                .totalItems(totalItems)
                .missingCount(missingCount)
                .needsFillCount(needsFillCount)
                .overstockedCount(overstockedCount)
                .reservedCount(reservedCount)
                .totalStockQty(totalStockQty)
                .build();
    }

    private List<StockItemStatus> queryItems(
            String sql,
            Long warehouseId,
            Long storageGroupId,
            Integer documentYear,
            String documentCode
    ) throws SQLException {
        return jdbc.query(
                withEligibleWarehouses(sql),
                ps -> bindEligibleWarehouseParams(ps, 1, warehouseId, storageGroupId, documentYear, documentCode),
                StockStatisticsRepository::mapRow
        );
    }

    private Long queryLong(
            String bodySql,
            Long warehouseId,
            Long storageGroupId,
            Integer documentYear,
            String documentCode
    ) throws SQLException {
        Long v = jdbc.queryOne(
                withEligibleWarehouses(bodySql),
                ps -> bindEligibleWarehouseParams(ps, 1, warehouseId, storageGroupId, documentYear, documentCode),
                rs -> rs.getLong(1)
        );
        return v == null ? 0L : v;
    }

    private BigDecimal queryDecimal(
            String bodySql,
            Long warehouseId,
            Long storageGroupId,
            Integer documentYear,
            String documentCode
    ) throws SQLException {
        BigDecimal v = jdbc.queryOne(
                withEligibleWarehouses(bodySql),
                ps -> bindEligibleWarehouseParams(ps, 1, warehouseId, storageGroupId, documentYear, documentCode),
                rs -> {
                    BigDecimal x = rs.getBigDecimal(1);
                    return x == null ? BigDecimal.ZERO : x;
                }
        );
        return v == null ? BigDecimal.ZERO : v;
    }

    private static String withEligibleWarehouses(String bodySql) {
        return """
                WITH eligible_warehouses AS (
                    SELECT DISTINCT r.SKLADISTE_ID
                      FROM SD_SIFREG r
                      JOIN SD_SIFREZ z ON z.SD_SIFREZ_ID = r.SD_SIFREZ_ID
                     WHERE TRIM(UPPER(z.DOKUMENTID)) = TRIM(UPPER(?))
                       AND (? IS NULL OR r.SKLADISTE_ID = ?)
                       AND (? IS NULL OR z.SKL_SIFREZ_ID = ?)
                       AND (
                            ? IS NULL
                            OR EXISTS (
                                SELECT 1
                                  FROM SD_GLAVA dg
                                 WHERE dg.DOKUMENT_ID = r.DOKUMENT_ID
                                   AND dg.DATUM_DOKUMENTA IS NOT NULL
                                   AND EXTRACT(YEAR FROM dg.DATUM_DOKUMENTA) = ?
                                   AND NVL(dg.KNJIZENO, 0) = 1
                                   AND NVL(dg.STORNO, 0) = 0
                                   AND dg.DATUM_STORNO IS NULL
                                   AND dg.STORNIRAO IS NULL
                            )
                       )
                )
                """ + bodySql;
    }

    private static int bindEligibleWarehouseParams(
            PreparedStatement ps,
            int start,
            Long warehouseId,
            Long storageGroupId,
            Integer documentYear,
            String documentCode
    ) throws SQLException {
        int i = start;
        ps.setString(i++, effectiveDocumentCode(documentCode));
        ps.setObject(i++, warehouseId);
        ps.setObject(i++, warehouseId);
        ps.setObject(i++, storageGroupId);
        ps.setObject(i++, storageGroupId);
        ps.setObject(i++, documentYear);
        ps.setObject(i++, documentYear);
        return i;
    }

    private static StringBuilder baseSelect() {
        return new StringBuilder("""
                SELECT *
                  FROM (
                    SELECT
                      g.ARTIKL_ID,
                      g.SKLADISTE_ID,
                      z.ARTIKLID,
                      n.NAZIV,
                      u.JEDINICAMJERE,
                      a.ZALIHATRENUTNA,
                      a.ZALIHAMINIMALNA,
                      a.ZALIHAPREPORUCENA,
                      a.ZALIHAREZERVIRANA
                    FROM SKL_ARTIKLIG g
                    JOIN eligible_warehouses ew ON ew.SKLADISTE_ID = g.SKLADISTE_ID
                    LEFT JOIN SKL_APROMETI a ON a.ARTIKL_ID = g.ARTIKL_ID
                    JOIN SKL_ARTIKLIZ z ON z.ARTIKLIZ_ID = g.ARTIKLIZ_ID
                    LEFT JOIN SKL_ANAZIVI n ON n.NAZIV_ID = g.NAZIV_ID
                    LEFT JOIN SIFRE_JMJ u ON u.JMJ_ID = z.JMJ_ID
                    WHERE NVL(g.AKTIVANARTIKL, 1) = 1
                """);
    }

    private static String effectiveDocumentCode(String documentCode) {
        return documentCode == null || documentCode.isBlank()
                ? DEFAULT_DOCUMENT_CODE
                : documentCode.trim().toUpperCase();
    }

    private static StockItemStatus mapRow(ResultSet rs) throws SQLException {
        Long itemId = rs.getLong("ARTIKL_ID");
        if (rs.wasNull()) itemId = null;

        Long whId = rs.getLong("SKLADISTE_ID");
        if (rs.wasNull()) whId = null;

        return StockItemStatus.builder()
                .itemId(itemId)
                .warehouseId(whId)
                .itemCode(rs.getString("ARTIKLID"))
                .name(rs.getString("NAZIV"))
                .unit(rs.getString("JEDINICAMJERE"))
                .currentQty(rs.getBigDecimal("ZALIHATRENUTNA"))
                .minimalQty(rs.getBigDecimal("ZALIHAMINIMALNA"))
                .recommendedQty(rs.getBigDecimal("ZALIHAPREPORUCENA"))
                .reservedQty(rs.getBigDecimal("ZALIHAREZERVIRANA"))
                .build();
    }
}

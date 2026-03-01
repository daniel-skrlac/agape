package hr.agape.stock.repository;

import hr.agape.common.database.Jdbc;
import hr.agape.stock.domain.StockItemStatus;
import hr.agape.stock.dto.StockStatisticsTotalsDTO;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

@ApplicationScoped
public class StockStatisticsRepository {

    private final Jdbc jdbc;

    @Inject
    public StockStatisticsRepository(Jdbc jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Missing = item exists in this warehouse (SKL_ARTIKLIG),
     * but has no SKL_APROMETI row OR ZALIHATRENUTNA is NULL OR <= 0 (can be negative too).
     */
    public List<StockItemStatus> findMissing(Long warehouseId, int limit) throws SQLException {
        StringBuilder inner = baseSelect();
        inner.append("""
                AND (
                      a.ARTIKL_ID IS NULL
                   OR a.ZALIHATRENUTNA IS NULL
                   OR a.ZALIHATRENUTNA <= 0
                )
                """);
        inner.append(" ORDER BY n.NAZIV ASC NULLS LAST, z.ARTIKLID ASC ");

        String sql = "SELECT * FROM (" + inner + ") WHERE ROWNUM <= ?";

        return jdbc.query(
                sql,
                ps -> {
                    ps.setLong(1, warehouseId);
                    ps.setInt(2, limit);
                },
                StockStatisticsRepository::mapRow
        );
    }

    /**
     * Needs fill = current > 0 and current < minimal (minimal must be > 0).
     */
    public List<StockItemStatus> findNeedsFill(Long warehouseId, int limit) throws SQLException {
        StringBuilder inner = baseSelect();
        inner.append("""
                AND a.ZALIHATRENUTNA IS NOT NULL
                AND a.ZALIHATRENUTNA > 0
                AND a.ZALIHAMINIMALNA IS NOT NULL
                AND a.ZALIHAMINIMALNA > 0
                AND a.ZALIHATRENUTNA < a.ZALIHAMINIMALNA
                """);

        inner.append(" ORDER BY (a.ZALIHATRENUTNA / a.ZALIHAMINIMALNA) ASC NULLS FIRST ");

        String sql = "SELECT * FROM (" + inner + ") WHERE ROWNUM <= ?";

        return jdbc.query(
                sql,
                ps -> {
                    ps.setLong(1, warehouseId);
                    ps.setInt(2, limit);
                },
                StockStatisticsRepository::mapRow
        );
    }

    /**
     * Most in stock = show only items that actually have stock (> 0).
     */
    public List<StockItemStatus> findMostInStock(Long warehouseId, int limit) throws SQLException {
        StringBuilder inner = baseSelect();
        inner.append("""
                AND a.ZALIHATRENUTNA IS NOT NULL
                AND a.ZALIHATRENUTNA > 0
                """);
        inner.append(" ORDER BY a.ZALIHATRENUTNA DESC, n.NAZIV ASC NULLS LAST ");

        String sql = "SELECT * FROM (" + inner + ") WHERE ROWNUM <= ?";

        return jdbc.query(
                sql,
                ps -> {
                    ps.setLong(1, warehouseId);
                    ps.setInt(2, limit);
                },
                StockStatisticsRepository::mapRow
        );
    }

    public StockStatisticsTotalsDTO loadTotals(Long warehouseId) throws SQLException {
        if (warehouseId == null) {
            throw new SQLException("warehouseId is required");
        }

        return jdbc.withConnection(c -> {

            Long totalItems = queryLong(
                    """
                            SELECT COUNT(*)
                            FROM SKL_ARTIKLIG g
                            WHERE NVL(g.AKTIVANARTIKL,1)=1
                              AND g.SKLADISTE_ID = ?
                            """,
                    warehouseId
            );

            Long missingCount = queryLong(
                    """
                            SELECT COUNT(*)
                            FROM SKL_ARTIKLIG g
                            LEFT JOIN SKL_APROMETI a ON a.ARTIKL_ID = g.ARTIKL_ID
                            WHERE NVL(g.AKTIVANARTIKL,1)=1
                              AND g.SKLADISTE_ID = ?
                              AND (
                                    a.ARTIKL_ID IS NULL
                                 OR a.ZALIHATRENUTNA IS NULL
                                 OR a.ZALIHATRENUTNA <= 0
                              )
                            """,
                    warehouseId
            );

            Long needsFillCount = queryLong(
                    """
                            SELECT COUNT(*)
                            FROM SKL_ARTIKLIG g
                            JOIN SKL_APROMETI a ON a.ARTIKL_ID = g.ARTIKL_ID
                            WHERE NVL(g.AKTIVANARTIKL,1)=1
                              AND g.SKLADISTE_ID = ?
                              AND a.ZALIHATRENUTNA IS NOT NULL
                              AND a.ZALIHATRENUTNA > 0
                              AND a.ZALIHAMINIMALNA IS NOT NULL
                              AND a.ZALIHAMINIMALNA > 0
                              AND a.ZALIHATRENUTNA < a.ZALIHAMINIMALNA
                            """,
                    warehouseId
            );

            Long overstockedCount = queryLong(
                    """
                            SELECT COUNT(*)
                            FROM SKL_ARTIKLIG g
                            JOIN SKL_APROMETI a ON a.ARTIKL_ID = g.ARTIKL_ID
                            WHERE NVL(g.AKTIVANARTIKL,1)=1
                              AND g.SKLADISTE_ID = ?
                              AND a.ZALIHATRENUTNA IS NOT NULL
                              AND a.ZALIHAPREPORUCENA IS NOT NULL
                              AND a.ZALIHATRENUTNA > a.ZALIHAPREPORUCENA
                            """,
                    warehouseId
            );

            Long reservedCount = queryLong(
                    """
                            SELECT COUNT(*)
                            FROM SKL_ARTIKLIG g
                            JOIN SKL_APROMETI a ON a.ARTIKL_ID = g.ARTIKL_ID
                            WHERE NVL(g.AKTIVANARTIKL,1)=1
                              AND g.SKLADISTE_ID = ?
                              AND a.ZALIHAREZERVIRANA IS NOT NULL
                              AND a.ZALIHAREZERVIRANA > 0
                            """,
                    warehouseId
            );

            BigDecimal totalStockQty = queryDecimal(
                    """
                            SELECT NVL(SUM(NVL(a.ZALIHATRENUTNA, 0)), 0)
                            FROM SKL_ARTIKLIG g
                            LEFT JOIN SKL_APROMETI a ON a.ARTIKL_ID = g.ARTIKL_ID
                            WHERE NVL(g.AKTIVANARTIKL,1)=1
                              AND g.SKLADISTE_ID = ?
                            """,
                    warehouseId
            );

            return StockStatisticsTotalsDTO.builder()
                    .totalItems(totalItems)
                    .missingCount(missingCount)
                    .needsFillCount(needsFillCount)
                    .overstockedCount(overstockedCount)
                    .reservedCount(reservedCount)
                    .totalStockQty(totalStockQty)
                    .build();
        });
    }

    private Long queryLong(String sql, Long warehouseId) throws SQLException {
        Long v = jdbc.queryOne(
                sql,
                ps -> ps.setLong(1, warehouseId),
                rs -> {
                    long x = rs.getLong(1);
                    return rs.wasNull() ? 0L : x;
                }
        );
        return v == null ? 0L : v;
    }

    private BigDecimal queryDecimal(String sql, Long warehouseId) throws SQLException {
        BigDecimal v = jdbc.queryOne(
                sql,
                ps -> ps.setLong(1, warehouseId),
                rs -> {
                    BigDecimal x = rs.getBigDecimal(1);
                    return x == null ? BigDecimal.ZERO : x;
                }
        );
        return v == null ? BigDecimal.ZERO : v;
    }

    private static StringBuilder baseSelect() {
        return new StringBuilder("""
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
                LEFT JOIN SKL_APROMETI a ON a.ARTIKL_ID = g.ARTIKL_ID
                JOIN SKL_ARTIKLIZ z ON z.ARTIKLIZ_ID = g.ARTIKLIZ_ID
                LEFT JOIN SKL_ANAZIVI n ON n.NAZIV_ID = g.NAZIV_ID
                LEFT JOIN SIFRE_JMJ u ON u.JMJ_ID = z.JMJ_ID
                WHERE NVL(g.AKTIVANARTIKL,1) = 1
                  AND g.SKLADISTE_ID = ?
                """);
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

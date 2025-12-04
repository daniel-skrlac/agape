package hr.agape.stock.repository;

import hr.agape.stock.domain.StockItemStatus;
import hr.agape.stock.dto.StockStatisticsTotalsDTO;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import javax.sql.DataSource;
import java.sql.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class StockStatisticsRepository {

    private final DataSource dataSource;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public StockStatisticsRepository(@io.quarkus.agroal.DataSource("oracle") DataSource dataSource) {
        this.dataSource = dataSource;
    }

    // -------------------------------------------------------------------------
    //   LIST QUERIES
    // -------------------------------------------------------------------------

    public List<StockItemStatus> findMissing(int limit) throws SQLException {
        StringBuilder inner = baseSelect();
        inner.append(" AND (a.ZALIHATRENUTNA IS NULL OR a.ZALIHATRENUTNA <= 0) ");
        inner.append(" ORDER BY n.NAZIV ASC, z.ARTIKLID ASC ");

        String sql = "SELECT * FROM (" + inner + ") WHERE ROWNUM <= ?";

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            ps.setInt(1, limit);
            return mapMany(ps.executeQuery());
        }
    }

    public List<StockItemStatus> findNeedsFill(int limit) throws SQLException {
        StringBuilder inner = baseSelect();
        inner.append("""
            AND a.ZALIHATRENUTNA IS NOT NULL
            AND a.ZALIHATRENUTNA > 0
            AND a.ZALIHAMINIMALNA IS NOT NULL
            AND a.ZALIHATRENUTNA < a.ZALIHAMINIMALNA
            """);

        inner.append(" ORDER BY (a.ZALIHATRENUTNA / a.ZALIHAMINIMALNA) ASC NULLS FIRST ");

        String sql = "SELECT * FROM (" + inner + ") WHERE ROWNUM <= ?";

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            ps.setInt(1, limit);
            return mapMany(ps.executeQuery());
        }
    }

    public List<StockItemStatus> findMostInStock(int limit) throws SQLException {
        StringBuilder inner = baseSelect();
        inner.append(" AND a.ZALIHATRENUTNA IS NOT NULL ");
        inner.append(" ORDER BY a.ZALIHATRENUTNA DESC, n.NAZIV ASC ");

        String sql = "SELECT * FROM (" + inner + ") WHERE ROWNUM <= ?";

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            ps.setInt(1, limit);
            return mapMany(ps.executeQuery());
        }
    }

    // -------------------------------------------------------------------------
    //   TOTALS
    // -------------------------------------------------------------------------

    public StockStatisticsTotalsDTO loadTotals() throws SQLException {
        try (Connection c = dataSource.getConnection()) {

            Long totalItems = queryLong(c,
                    "SELECT COUNT(*) FROM SKL_ARTIKLIG WHERE NVL(AKTIVANARTIKL,1) = 1");

            Long missingCount = queryLong(c, """
                SELECT COUNT(*)
                FROM SKL_APROMETI a
                JOIN SKL_ARTIKLIG g ON g.ARTIKL_ID = a.ARTIKL_ID
                WHERE NVL(g.AKTIVANARTIKL,1)=1
                  AND (a.ZALIHATRENUTNA IS NULL OR a.ZALIHATRENUTNA <= 0)
            """);

            Long needsFillCount = queryLong(c, """
                SELECT COUNT(*)
                FROM SKL_APROMETI a
                JOIN SKL_ARTIKLIG g ON g.ARTIKL_ID = a.ARTIKL_ID
                WHERE NVL(g.AKTIVANARTIKL,1)=1
                  AND a.ZALIHATRENUTNA > 0
                  AND a.ZALIHAMINIMALNA IS NOT NULL
                  AND a.ZALIHATRENUTNA < a.ZALIHAMINIMALNA
            """);

            Long overstockedCount = queryLong(c, """
                SELECT COUNT(*)
                FROM SKL_APROMETI a
                JOIN SKL_ARTIKLIG g ON g.ARTIKL_ID = a.ARTIKL_ID
                WHERE NVL(g.AKTIVANARTIKL,1)=1
                  AND a.ZALIHATRENUTNA > a.ZALIHAPREPORUCENA
            """);

            Long reservedCount = queryLong(c, """
                SELECT COUNT(*)
                FROM SKL_APROMETI a
                JOIN SKL_ARTIKLIG g ON g.ARTIKL_ID = a.ARTIKL_ID
                WHERE NVL(g.AKTIVANARTIKL,1)=1
                  AND a.ZALIHAREZERVIRANA > 0
            """);

            BigDecimal totalStockQty = queryDecimal(c, """
                SELECT NVL(SUM(a.ZALIHATRENUTNA), 0)
                FROM SKL_APROMETI a
                JOIN SKL_ARTIKLIG g ON g.ARTIKL_ID = a.ARTIKL_ID
                WHERE NVL(g.AKTIVANARTIKL,1)=1
            """);

            return StockStatisticsTotalsDTO.builder()
                    .totalItems(totalItems)
                    .missingCount(missingCount)
                    .needsFillCount(needsFillCount)
                    .overstockedCount(overstockedCount)
                    .reservedCount(reservedCount)
                    .totalStockQty(totalStockQty)
                    .build();
        }
    }

    // -------------------------------------------------------------------------
    // SQL helpers
    // -------------------------------------------------------------------------

    private static Long queryLong(Connection c, String sql) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            rs.next();
            return rs.getLong(1);
        }
    }

    private static BigDecimal queryDecimal(Connection c, String sql) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            rs.next();
            return rs.getBigDecimal(1);
        }
    }

    private static StringBuilder baseSelect() {
        return new StringBuilder("""
            SELECT
              a.ARTIKL_ID,
              g.SKLADISTE_ID,
              z.ARTIKLID,
              n.NAZIV,
              u.JEDINICAMJERE,
              a.ZALIHATRENUTNA,
              a.ZALIHAMINIMALNA,
              a.ZALIHAPREPORUCENA,
              a.ZALIHAREZERVIRANA
            FROM SKL_APROMETI a
            JOIN SKL_ARTIKLIG g ON g.ARTIKL_ID = a.ARTIKL_ID
            JOIN SKL_ARTIKLIZ z ON z.ARTIKLIZ_ID = g.ARTIKLIZ_ID
            LEFT JOIN SKL_ANAZIVI n ON n.NAZIV_ID = g.NAZIV_ID
            LEFT JOIN SIFRE_JMJ u ON u.JMJ_ID = z.JMJ_ID
            WHERE NVL(g.AKTIVANARTIKL,1) = 1
        """);
    }

    private static List<StockItemStatus> mapMany(ResultSet rs) throws SQLException {
        List<StockItemStatus> out = new ArrayList<>();
        while (rs.next()) {
            out.add(mapRow(rs));
        }
        return out;
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

package hr.agape.item.repository;

import hr.agape.common.database.Jdbc;
import hr.agape.item.domain.ItemDirectoryView;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@ApplicationScoped
public class ItemDirectoryRepository {

    private final Jdbc jdbc;

    @Inject
    public ItemDirectoryRepository(Jdbc jdbc) {
        this.jdbc = jdbc;
    }

    public List<ItemDirectoryView> findItemsByIds(List<Long> itemIds) throws SQLException {
        if (itemIds == null || itemIds.isEmpty()) {
            return List.of();
        }

        List<Long> ids = itemIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (ids.isEmpty()) {
            return List.of();
        }

        String placeholders = ids.stream()
                .map(x -> "?")
                .collect(Collectors.joining(","));

        final String sql = """
                WITH base AS (
                    SELECT
                        g.ARTIKL_ID              AS ITEM_ID,
                        z.ARTIKLID               AS CODE,
                        n.NAZIV                  AS NAME,
                        u.JEDINICAMJERE          AS UNIT,
                        (SELECT MIN(e.EAN)
                           FROM SKL_EAN e
                          WHERE e.ARTIKLIZ_ID = z.ARTIKLIZ_ID
                        ) AS BARCODE,
                        ROW_NUMBER() OVER (
                            PARTITION BY g.ARTIKL_ID
                            ORDER BY NVL(g.AKTIVANARTIKL, 1) DESC, g.SKLADISTE_ID, z.ARTIKLIZ_ID
                        ) AS RN
                    FROM SKL_ARTIKLIG g
                    JOIN SKL_ARTIKLIZ z ON z.ARTIKLIZ_ID = g.ARTIKLIZ_ID
                    JOIN SKL_ANAZIVI  n ON n.NAZIV_ID   = g.NAZIV_ID
                    LEFT JOIN SIFRE_JMJ u ON u.JMJ_ID   = z.JMJ_ID
                    WHERE g.ARTIKL_ID IN (%s)
                )
                SELECT ITEM_ID, CODE, NAME, UNIT, BARCODE
                  FROM base
                 WHERE RN = 1
                 ORDER BY LOWER(NAME), ITEM_ID
                """.formatted(placeholders);

        return jdbc.query(
                sql,
                ps -> {
                    int i = 1;
                    for (Long id : ids) {
                        ps.setLong(i++, id);
                    }
                },
                rs -> ItemDirectoryView.builder()
                        .itemId(rs.getLong("ITEM_ID"))
                        .code(rs.getString("CODE"))
                        .name(rs.getString("NAME"))
                        .unit(rs.getString("UNIT"))
                        .barcode(rs.getString("BARCODE"))
                        .build()
        );
    }

    public Map<String, ItemDirectoryView> findItemsByWarehouseAndIds(Map<Long, ? extends Iterable<Long>> itemIdsByWarehouse) throws SQLException {
        if (itemIdsByWarehouse == null || itemIdsByWarehouse.isEmpty()) {
            return Map.of();
        }

        List<long[]> pairs = new java.util.ArrayList<>();
        java.util.LinkedHashSet<String> seenPairs = new java.util.LinkedHashSet<>();

        for (Map.Entry<Long, ? extends Iterable<Long>> entry : itemIdsByWarehouse.entrySet()) {
            Long warehouseId = entry.getKey();
            if (warehouseId == null || warehouseId <= 0 || entry.getValue() == null) {
                continue;
            }

            for (Long itemId : entry.getValue()) {
                if (itemId == null || itemId <= 0) {
                    continue;
                }

                String key = warehouseItemKey(warehouseId, itemId);
                if (seenPairs.add(key)) {
                    pairs.add(new long[]{warehouseId, itemId});
                }
            }
        }

        if (pairs.isEmpty()) {
            return Map.of();
        }

        String requestedRows = pairs.stream()
                .map(x -> "SELECT ? AS WAREHOUSE_ID, ? AS ITEM_ID FROM DUAL")
                .collect(Collectors.joining("\nUNION ALL\n"));

        final String sql = """
                WITH requested AS (
                    %s
                ),
                base AS (
                    SELECT
                        req.WAREHOUSE_ID         AS WAREHOUSE_ID,
                        g.ARTIKL_ID              AS ITEM_ID,
                        z.ARTIKLID               AS CODE,
                        n.NAZIV                  AS NAME,
                        u.JEDINICAMJERE          AS UNIT,
                        (SELECT MIN(e.EAN)
                           FROM SKL_EAN e
                          WHERE e.ARTIKLIZ_ID = z.ARTIKLIZ_ID
                        ) AS BARCODE,
                        ROW_NUMBER() OVER (
                            PARTITION BY req.WAREHOUSE_ID, g.ARTIKL_ID
                            ORDER BY NVL(g.AKTIVANARTIKL, 1) DESC, z.ARTIKLIZ_ID
                        ) AS RN
                      FROM requested req
                      JOIN SKL_ARTIKLIG g
                        ON g.SKLADISTE_ID = req.WAREHOUSE_ID
                       AND g.ARTIKL_ID = req.ITEM_ID
                      JOIN SKL_ARTIKLIZ z ON z.ARTIKLIZ_ID = g.ARTIKLIZ_ID
                      JOIN SKL_ANAZIVI  n ON n.NAZIV_ID   = g.NAZIV_ID
                      LEFT JOIN SIFRE_JMJ u ON u.JMJ_ID   = z.JMJ_ID
                     WHERE NVL(g.AKTIVANARTIKL, 1) = 1
                )
                SELECT WAREHOUSE_ID, ITEM_ID, CODE, NAME, UNIT, BARCODE
                  FROM base
                 WHERE RN = 1
                 ORDER BY WAREHOUSE_ID, LOWER(NAME), ITEM_ID
                """.formatted(requestedRows);

        return jdbc.query(
                sql,
                ps -> {
                    int i = 1;
                    for (long[] pair : pairs) {
                        ps.setLong(i++, pair[0]);
                        ps.setLong(i++, pair[1]);
                    }
                },
                rs -> {
                    Long warehouseId = rs.getLong("WAREHOUSE_ID");
                    Long itemId = rs.getLong("ITEM_ID");
                    return Map.entry(
                            warehouseItemKey(warehouseId, itemId),
                            ItemDirectoryView.builder()
                                    .itemId(itemId)
                                    .code(rs.getString("CODE"))
                                    .name(rs.getString("NAME"))
                                    .unit(rs.getString("UNIT"))
                                    .barcode(rs.getString("BARCODE"))
                                    .build()
                    );
                }
        ).stream().collect(Collectors.toMap(
                Map.Entry::getKey,
                Map.Entry::getValue,
                (first, second) -> first,
                LinkedHashMap::new
        ));
    }

    public static String warehouseItemKey(Long warehouseId, Long itemId) {
        return String.valueOf(warehouseId) + ":" + String.valueOf(itemId);
    }

    public List<ItemDirectoryView> findItemsByCodes(
            Long warehouseId,
            List<String> exactCodes,
            List<String> numericCodes,
            List<String> paddedNumericCodes
    ) throws SQLException {
        if (warehouseId == null || exactCodes == null || exactCodes.isEmpty()) {
            return List.of();
        }

        String exactPlaceholders = exactCodes.stream()
                .map(x -> "?")
                .collect(Collectors.joining(","));

        final String sql = """
                WITH base AS (
                    SELECT
                        g.ARTIKL_ID              AS ITEM_ID,
                        z.ARTIKLID               AS CODE,
                        n.NAZIV                  AS NAME,
                        u.JEDINICAMJERE          AS UNIT,
                        (SELECT MIN(e.EAN)
                           FROM SKL_EAN e
                          WHERE e.ARTIKLIZ_ID = z.ARTIKLIZ_ID
                        ) AS BARCODE,
                        ROW_NUMBER() OVER (
                            PARTITION BY g.ARTIKL_ID
                            ORDER BY NVL(g.AKTIVANARTIKL, 1) DESC, z.ARTIKLIZ_ID
                        ) AS RN
                      FROM SKL_ARTIKLIG g
                      JOIN SKL_ARTIKLIZ z ON z.ARTIKLIZ_ID = g.ARTIKLIZ_ID
                      JOIN SKL_ANAZIVI  n ON n.NAZIV_ID   = g.NAZIV_ID
                      LEFT JOIN SIFRE_JMJ u ON u.JMJ_ID   = z.JMJ_ID
                     WHERE g.SKLADISTE_ID = ?
                       AND NVL(g.AKTIVANARTIKL, 1) = 1
                       AND (
                            UPPER(TRIM(z.ARTIKLID)) IN (%s)
                       )
                )
                SELECT ITEM_ID, CODE, NAME, UNIT, BARCODE
                  FROM base
                 WHERE RN = 1
                 ORDER BY CODE, ITEM_ID
                """.formatted(exactPlaceholders);

        return jdbc.query(
                sql,
                ps -> {
                    int i = 1;

                    ps.setObject(i++, warehouseId);

                    for (String code : exactCodes) {
                        ps.setString(i++, code);
                    }
                },
                rs -> ItemDirectoryView.builder()
                        .itemId(rs.getLong("ITEM_ID"))
                        .code(rs.getString("CODE"))
                        .name(rs.getString("NAME"))
                        .unit(rs.getString("UNIT"))
                        .barcode(rs.getString("BARCODE"))
                        .build()
        );
    }

    public long countItems(Long warehouseId, String q) throws SQLException {
        String qq = q == null ? null : q.trim().toLowerCase();

        if (qq == null || qq.isBlank()) {
            final String sql = """
                    SELECT COUNT(DISTINCT g.ARTIKL_ID)
                      FROM SKL_ARTIKLIG g
                     WHERE g.SKLADISTE_ID = ?
                       AND NVL(g.AKTIVANARTIKL, 1) = 1
                    """;

            Long cnt = jdbc.queryOne(
                    sql,
                    ps -> ps.setObject(1, warehouseId),
                    rs -> rs.getLong(1)
            );

            return cnt == null ? 0L : cnt;
        }

        final String sql = """
                SELECT COUNT(*)
                  FROM (
                    SELECT DISTINCT g.ARTIKL_ID
                      FROM SKL_ARTIKLIG g
                      JOIN SKL_ARTIKLIZ z ON z.ARTIKLIZ_ID = g.ARTIKLIZ_ID
                      JOIN SKL_ANAZIVI  n ON n.NAZIV_ID   = g.NAZIV_ID
                     WHERE g.SKLADISTE_ID = ?
                       AND NVL(g.AKTIVANARTIKL, 1) = 1
                       AND (
                            ? IS NULL OR ? = '' OR
                            LOWER(n.NAZIV) LIKE ? OR
                            LOWER(z.ARTIKLID) LIKE ? OR
                            TO_CHAR(g.ARTIKL_ID) LIKE ? OR
                            EXISTS (
                                SELECT 1
                                  FROM SKL_EAN e
                                 WHERE e.ARTIKLIZ_ID = z.ARTIKLIZ_ID
                                   AND LOWER(e.EAN) LIKE ?
                            )
                       )
                  )
                """;

        String like = "%" + qq + "%";

        Long cnt = jdbc.queryOne(
                sql,
                ps -> {
                    int i = 1;

                    ps.setObject(i++, warehouseId);

                    ps.setString(i++, qq);
                    ps.setString(i++, qq);

                    ps.setString(i++, like);
                    ps.setString(i++, like);
                    ps.setString(i++, like);
                    ps.setString(i++, like);
                },
                rs -> rs.getLong(1)
        );

        return cnt == null ? 0L : cnt;
    }

    public List<ItemDirectoryView> pageItems(Long warehouseId, int offset, int limit, String q) throws SQLException {
        String qq = q == null ? null : q.trim().toLowerCase();

        if (qq == null || qq.isBlank()) {
            final String sql = """
                    WITH base AS (
                        SELECT
                            g.ARTIKL_ID              AS ITEM_ID,
                            z.ARTIKLID               AS CODE,
                            n.NAZIV                  AS NAME,
                            u.JEDINICAMJERE          AS UNIT,
                            (SELECT MIN(e.EAN)
                               FROM SKL_EAN e
                              WHERE e.ARTIKLIZ_ID = z.ARTIKLIZ_ID
                            ) AS BARCODE
                          FROM SKL_ARTIKLIG g
                          JOIN SKL_ARTIKLIZ z ON z.ARTIKLIZ_ID = g.ARTIKLIZ_ID
                          JOIN SKL_ANAZIVI  n ON n.NAZIV_ID   = g.NAZIV_ID
                          LEFT JOIN SIFRE_JMJ u ON u.JMJ_ID  = z.JMJ_ID
                         WHERE g.SKLADISTE_ID = ?
                           AND NVL(g.AKTIVANARTIKL, 1) = 1
                         GROUP BY
                            g.ARTIKL_ID,
                            z.ARTIKLID,
                            n.NAZIV,
                            u.JEDINICAMJERE,
                            z.ARTIKLIZ_ID
                    ),
                    ranked AS (
                        SELECT b.*,
                               ROW_NUMBER() OVER (ORDER BY LOWER(b.NAME), b.ITEM_ID) AS RN
                          FROM base b
                    )
                    SELECT ITEM_ID, CODE, NAME, UNIT, BARCODE
                      FROM ranked
                     WHERE RN BETWEEN ? AND ?
                     ORDER BY RN
                    """;

            int start = offset + 1;
            int end = offset + limit;

            return jdbc.query(
                    sql,
                    ps -> {
                        int i = 1;
                        ps.setObject(i++, warehouseId);
                        ps.setInt(i++, start);
                        ps.setInt(i++, end);
                    },
                    rs -> ItemDirectoryView.builder()
                            .itemId(rs.getLong("ITEM_ID"))
                            .code(rs.getString("CODE"))
                            .name(rs.getString("NAME"))
                            .unit(rs.getString("UNIT"))
                            .barcode(rs.getString("BARCODE"))
                            .build()
            );
        }

        final String sql = """
                WITH base AS (
                    SELECT
                        g.ARTIKL_ID              AS ITEM_ID,
                        z.ARTIKLID               AS CODE,
                        n.NAZIV                  AS NAME,
                        u.JEDINICAMJERE          AS UNIT,
                        (SELECT MIN(e.EAN)
                           FROM SKL_EAN e
                          WHERE e.ARTIKLIZ_ID = z.ARTIKLIZ_ID
                        ) AS BARCODE
                      FROM SKL_ARTIKLIG g
                      JOIN SKL_ARTIKLIZ z ON z.ARTIKLIZ_ID = g.ARTIKLIZ_ID
                      JOIN SKL_ANAZIVI  n ON n.NAZIV_ID   = g.NAZIV_ID
                      LEFT JOIN SIFRE_JMJ u ON u.JMJ_ID  = z.JMJ_ID
                     WHERE g.SKLADISTE_ID = ?
                       AND NVL(g.AKTIVANARTIKL, 1) = 1
                       AND (
                            ? IS NULL OR ? = '' OR
                            LOWER(n.NAZIV) LIKE ? OR
                            LOWER(z.ARTIKLID) LIKE ? OR
                            TO_CHAR(g.ARTIKL_ID) LIKE ? OR
                            EXISTS (
                                SELECT 1
                                  FROM SKL_EAN e
                                 WHERE e.ARTIKLIZ_ID = z.ARTIKLIZ_ID
                                   AND LOWER(e.EAN) LIKE ?
                            )
                       )
                     GROUP BY
                        g.ARTIKL_ID,
                        z.ARTIKLID,
                        n.NAZIV,
                        u.JEDINICAMJERE,
                        z.ARTIKLIZ_ID
                ),
                ranked AS (
                    SELECT b.*,
                           ROW_NUMBER() OVER (ORDER BY LOWER(b.NAME), b.ITEM_ID) AS RN
                      FROM base b
                )
                SELECT ITEM_ID, CODE, NAME, UNIT, BARCODE
                  FROM ranked
                 WHERE RN BETWEEN ? AND ?
                 ORDER BY RN
                """;

        String like = "%" + qq + "%";

        int start = offset + 1;
        int end = offset + limit;

        return jdbc.query(
                sql,
                ps -> {
                    int i = 1;

                    ps.setObject(i++, warehouseId);

                    ps.setString(i++, qq);
                    ps.setString(i++, qq);

                    ps.setString(i++, like);
                    ps.setString(i++, like);
                    ps.setString(i++, like);
                    ps.setString(i++, like);

                    ps.setInt(i++, start);
                    ps.setInt(i++, end);
                },
                rs -> ItemDirectoryView.builder()
                        .itemId(rs.getLong("ITEM_ID"))
                        .code(rs.getString("CODE"))
                        .name(rs.getString("NAME"))
                        .unit(rs.getString("UNIT"))
                        .barcode(rs.getString("BARCODE"))
                        .build()
        );
    }
}

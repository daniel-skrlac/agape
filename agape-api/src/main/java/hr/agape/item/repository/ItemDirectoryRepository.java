package hr.agape.item.repository;

import hr.agape.common.database.Jdbc;
import hr.agape.item.domain.ItemDirectoryView;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.sql.SQLException;
import java.util.List;
import java.util.Objects;

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
                .collect(java.util.stream.Collectors.joining(","));

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

    public long countItems(Long warehouseId, String q) throws SQLException {
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

        String qq = (q == null) ? null : q.trim().toLowerCase();
        String like = (qq == null || qq.isBlank()) ? null : "%" + qq + "%";

        Long cnt = jdbc.queryOne(
                sql,
                ps -> {
                    int i = 1;
                    ps.setObject(i++, warehouseId);

                    ps.setString(i++, qq);
                    ps.setString(i++, qq);

                    ps.setString(i++, like); // naziv
                    ps.setString(i++, like); // artiklid
                    ps.setString(i++, like); // artikl_id
                    ps.setString(i++, like); // ean
                },
                rs -> rs.getLong(1)
        );

        return (cnt == null) ? 0L : cnt;
    }

    public List<ItemDirectoryView> pageItems(Long warehouseId, int offset, int limit, String q) throws SQLException {
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

        String qq = (q == null) ? null : q.trim().toLowerCase();
        String like = (qq == null || qq.isBlank()) ? null : "%" + qq + "%";

        int start = offset + 1;
        int end = offset + limit;

        return jdbc.query(
                sql,
                ps -> {
                    int i = 1;
                    ps.setObject(i++, warehouseId);

                    ps.setString(i++, qq);
                    ps.setString(i++, qq);

                    ps.setString(i++, like); // naziv
                    ps.setString(i++, like); // artiklid
                    ps.setString(i++, like); // artikl_id
                    ps.setString(i++, like); // ean

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

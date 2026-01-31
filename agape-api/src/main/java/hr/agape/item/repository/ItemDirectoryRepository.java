package hr.agape.item.repository;

import hr.agape.common.database.Jdbc;
import hr.agape.item.domain.ItemDirectoryView;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.sql.SQLException;
import java.util.List;

@ApplicationScoped
public class ItemDirectoryRepository {

    private final Jdbc jdbc;

    @Inject
    public ItemDirectoryRepository(Jdbc jdbc) {
        this.jdbc = jdbc;
    }

    public long countItems(Long warehouseId, String q) throws SQLException {
        final String sql = """
                SELECT COUNT(*)
                  FROM (
                        SELECT DISTINCT g.ARTIKL_ID
                          FROM SKL_ARTIKLIG g
                          JOIN SKL_ARTIKLIZ z ON z.ARTIKL_ID = g.ARTIKL_ID
                          JOIN SKL_ANAZIVI  n ON n.NAZIV_ID  = z.NAZIV_ID
                         WHERE g.SKLADISTE_ID = ?
                           AND NVL(g.AKTIVANARTIKL, 1) = 1
                           AND (
                                ? IS NULL OR ? = '' OR
                                LOWER(n.NAZIV) LIKE ? OR
                                LOWER(z.KUP_ARTIKLID) LIKE ? OR
                                TO_CHAR(g.ARTIKL_ID) LIKE ? OR
                                EXISTS (
                                    SELECT 1
                                      FROM SKL_BARKODI bb
                                     WHERE bb.ARTIKL_ID = g.ARTIKL_ID
                                       AND LOWER(bb.BARKOD) LIKE ?
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

                    // q null/blank checks
                    ps.setString(i++, qq);
                    ps.setString(i++, qq);

                    // LIKE / EXISTS like
                    ps.setString(i++, like);
                    ps.setString(i++, like);
                    ps.setString(i++, like);
                    ps.setString(i++, like);
                },
                rs -> rs.getLong(1)
        );

        return (cnt == null) ? 0L : cnt;
    }

    public List<ItemDirectoryView> pageItems(Long warehouseId, int offset, int limit, String q) throws SQLException {
        final String sql = """
                WITH base AS (
                    SELECT
                        g.ARTIKL_ID AS ITEM_ID,
                        z.KUP_ARTIKLID AS CODE,
                        n.NAZIV AS NAME,
                        u.OZNAKA AS UNIT,
                        (SELECT MIN(bb.BARKOD)
                           FROM SKL_BARKODI bb
                          WHERE bb.ARTIKL_ID = g.ARTIKL_ID
                        ) AS BARCODE
                      FROM SKL_ARTIKLIG g
                      JOIN SKL_ARTIKLIZ z ON z.ARTIKL_ID = g.ARTIKL_ID
                      JOIN SKL_ANAZIVI  n ON n.NAZIV_ID  = z.NAZIV_ID
                      LEFT JOIN SIFRE_JMJ u ON u.JMJ_ID = g.JMJ_ID
                     WHERE g.SKLADISTE_ID = ?
                       AND NVL(g.AKTIVANARTIKL, 1) = 1
                       AND (
                            ? IS NULL OR ? = '' OR
                            LOWER(n.NAZIV) LIKE ? OR
                            LOWER(z.KUP_ARTIKLID) LIKE ? OR
                            TO_CHAR(g.ARTIKL_ID) LIKE ? OR
                            EXISTS (
                                SELECT 1
                                  FROM SKL_BARKODI bb
                                 WHERE bb.ARTIKL_ID = g.ARTIKL_ID
                                   AND LOWER(bb.BARKOD) LIKE ?
                            )
                       )
                     GROUP BY g.ARTIKL_ID, z.KUP_ARTIKLID, n.NAZIV, u.OZNAKA
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

                    // q null/blank checks
                    ps.setString(i++, qq);
                    ps.setString(i++, qq);

                    // LIKE / EXISTS like
                    ps.setString(i++, like);
                    ps.setString(i++, like);
                    ps.setString(i++, like);
                    ps.setString(i++, like);

                    // paging
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

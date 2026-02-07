package hr.agape.stock.repository;

import hr.agape.common.database.Jdbc;
import hr.agape.stock.domain.StockItemStatus;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@ApplicationScoped
public class StockSnapshotRepository {

    private final Jdbc jdbc;

    @Inject
    public StockSnapshotRepository(Jdbc jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Loads snapshot for ARTIKL_IDs that belong to warehouse (SKL_ARTIKLIG.SKLADISTE_ID).
     * Includes counters from SKL_APROMETI:
     * - ZALIHATRENUTNA
     * - ZALIHANEPROKNJIZENA (pending OUT)
     * - ZALIHAKALKULACIJA   (pending IN)
     * - INPKOLICINA
     * - OUTKOLICINA
     */
    public Map<Long, StockItemStatus> loadForWarehouse(Long warehouseId, Collection<Long> artiklIds) throws SQLException {
        if (warehouseId == null || artiklIds == null || artiklIds.isEmpty()) return Map.of();

        List<Long> ids = artiklIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (ids.isEmpty()) return Map.of();

        String in = ids.stream().map(x -> "?").collect(Collectors.joining(","));

        String sql = """
                SELECT
                  g.ARTIKL_ID,
                  g.SKLADISTE_ID,
                  z.ARTIKLID        AS ITEM_CODE,
                  n.NAZIV           AS ITEM_NAME,
                  u.JEDINICAMJERE   AS UNIT,
                  a.ZALIHATRENUTNA,
                  a.ZALIHANEPROKNJIZENA,
                  a.ZALIHAKALKULACIJA,
                  a.INPKOLICINA,
                  a.OUTKOLICINA
                FROM SKL_ARTIKLIG g
                JOIN SKL_ARTIKLIZ z ON z.ARTIKLIZ_ID = g.ARTIKLIZ_ID
                LEFT JOIN SKL_ANAZIVI n ON n.NAZIV_ID = g.NAZIV_ID
                LEFT JOIN SIFRE_JMJ u ON u.JMJ_ID = z.JMJ_ID
                LEFT JOIN SKL_APROMETI a ON a.ARTIKL_ID = g.ARTIKL_ID
                WHERE g.SKLADISTE_ID = ?
                  AND g.ARTIKL_ID IN (%s)
                """.formatted(in);

        return jdbc.withConnection(c -> {
            try (PreparedStatement ps = c.prepareStatement(sql)) {
                int idx = 1;
                ps.setLong(idx++, warehouseId);
                for (Long id : ids) ps.setLong(idx++, id);

                Map<Long, StockItemStatus> out = new HashMap<>();
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        StockItemStatus s = StockItemStatus.builder()
                                .itemId(rs.getLong("ARTIKL_ID"))
                                .warehouseId(rs.getLong("SKLADISTE_ID"))
                                .itemCode(rs.getString("ITEM_CODE"))
                                .name(rs.getString("ITEM_NAME"))
                                .unit(rs.getString("UNIT"))

                                .currentQty(rs.getBigDecimal("ZALIHATRENUTNA"))
                                .pendingOutQty(rs.getBigDecimal("ZALIHANEPROKNJIZENA"))
                                .pendingInQty(rs.getBigDecimal("ZALIHAKALKULACIJA"))

                                .inQty(rs.getBigDecimal("INPKOLICINA"))
                                .outQty(rs.getBigDecimal("OUTKOLICINA"))
                                .build();
                        out.put(s.getItemId(), s);
                    }
                }
                return out;
            }
        });
    }
}

package hr.agape.stock.repository;

import hr.agape.common.database.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.Map;

@ApplicationScoped
public class PendingStockRepository {

    private final Jdbc jdbc;

    @Inject
    public PendingStockRepository(Jdbc jdbc) {
        this.jdbc = jdbc;
    }

    public void applyPendingOutDelta(Map<Long, BigDecimal> deltaByArtiklId) throws SQLException {
        if (deltaByArtiklId == null || deltaByArtiklId.isEmpty()) return;

        String sql = """
                    MERGE INTO SKL_APROMETI a
                    USING (SELECT ? AS ARTIKL_ID, ? AS DELTA_VAL FROM dual) s
                       ON (a.ARTIKL_ID = s.ARTIKL_ID)
                    WHEN MATCHED THEN
                      UPDATE SET a.ZALIHANEPROKNJIZENA = NVL(a.ZALIHANEPROKNJIZENA, 0) + s.DELTA_VAL
                    WHEN NOT MATCHED THEN
                      INSERT (ARTIKL_ID, ZALIHATRENUTNA, ZALIHANEPROKNJIZENA, ZALIHAKALKULACIJA)
                      VALUES (s.ARTIKL_ID, 0, s.DELTA_VAL, 0)
                """;

        for (var e : deltaByArtiklId.entrySet()) {
            Long artiklId = e.getKey();
            BigDecimal delta = e.getValue();
            if (artiklId == null || delta == null || delta.signum() == 0) continue;

            jdbc.update(sql, ps -> {
                ps.setLong(1, artiklId);
                ps.setBigDecimal(2, delta);
            });
        }
    }

    public void applyPendingInDelta(Map<Long, BigDecimal> deltaByArtiklId) throws SQLException {
        if (deltaByArtiklId == null || deltaByArtiklId.isEmpty()) return;

        String sql = """
                    MERGE INTO SKL_APROMETI a
                    USING (SELECT ? AS ARTIKL_ID, ? AS DELTA_VAL FROM dual) s
                       ON (a.ARTIKL_ID = s.ARTIKL_ID)
                    WHEN MATCHED THEN
                      UPDATE SET a.ZALIHAKALKULACIJA = NVL(a.ZALIHAKALKULACIJA, 0) + s.DELTA_VAL
                    WHEN NOT MATCHED THEN
                      INSERT (ARTIKL_ID, ZALIHATRENUTNA, ZALIHANEPROKNJIZENA, ZALIHAKALKULACIJA)
                      VALUES (s.ARTIKL_ID, 0, 0, s.DELTA_VAL)
                """;

        for (var e : deltaByArtiklId.entrySet()) {
            Long artiklId = e.getKey();
            BigDecimal delta = e.getValue();
            if (artiklId == null || delta == null || delta.signum() == 0) continue;

            jdbc.update(sql, ps -> {
                ps.setLong(1, artiklId);
                ps.setBigDecimal(2, delta);
            });
        }
    }
}

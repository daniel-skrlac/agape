package hr.agape.warehouse.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class WarehouseRepository {

    private final DataSource dataSource;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public WarehouseRepository(@io.quarkus.agroal.DataSource("oracle") DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public List<Long> listWarehouses() throws SQLException {
        String sql = """
                    SELECT DISTINCT g.SKLADISTE_ID
                    FROM SKL_ARTIKLIG g
                    WHERE NVL(g.AKTIVANARTIKL,1) = 1
                    ORDER BY g.SKLADISTE_ID
                """;

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            List<Long> out = new ArrayList<>();
            while (rs.next()) {
                out.add(rs.getLong(1));
            }
            return out;
        }
    }
}

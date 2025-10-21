package agapi.document.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

@ApplicationScoped
public class ItemRepository {

    private final DataSource dataSource;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public ItemRepository(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public boolean isMissingOrInactive(int itemId) throws SQLException {
        String sql = """
                    SELECT 1
                      FROM SKL_ARTIKLIG
                     WHERE ARTIKL_ID = ?
                       AND NVL(AKTIVANARTIKL, 1) = 1
                """;
        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, itemId);
            try (ResultSet rs = ps.executeQuery()) {
                return !rs.next();
            }
        }
    }
}

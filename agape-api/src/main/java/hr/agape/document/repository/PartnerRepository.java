package hr.agape.document.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

@ApplicationScoped
public class PartnerRepository {

    private final DataSource dataSource;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public PartnerRepository(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public boolean isMissingOrInactive(int partnerId) throws SQLException {
        String sql = """
                    SELECT 1
                      FROM PARTNERI
                     WHERE PARTNER_ID = ?
                       AND NVL(AKTIVAN, 1) = 1
                """;
        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, partnerId);
            try (ResultSet rs = ps.executeQuery()) {
                return !rs.next();
            }
        }
    }
}

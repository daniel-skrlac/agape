package hr.agape.document.user.repository;

import hr.agape.common.config.AgapeConfig;
import hr.agape.common.database.Jdbc;
import hr.agape.document.user.domain.UserEntity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.sql.SQLException;

@ApplicationScoped
public class UserRepository {

    private final Jdbc jdbc;
    private final AgapeConfig agapeConfig;

    @Inject
    public UserRepository(Jdbc jdbc, AgapeConfig agapeConfig) {
        this.jdbc = jdbc;
        this.agapeConfig = agapeConfig;
    }

    public UserEntity findByOib() throws SQLException {
        final String sql = """
                SELECT KORISNIK_ID, OIB, SUSTAVPDVA
                  FROM KORISNIK
                 WHERE OIB = ?
                """;

        return jdbc.queryOne(sql, ps -> ps.setString(1, agapeConfig.oib()), rs ->
                UserEntity.builder()
                        .userId(rs.getLong("KORISNIK_ID"))
                        .oib(rs.getString("OIB"))
                        .vatSystem(rs.getInt("SUSTAVPDVA"))
                        .build()
        );
    }
}

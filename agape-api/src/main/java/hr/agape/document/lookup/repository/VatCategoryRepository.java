package hr.agape.document.lookup.repository;

import hr.agape.common.database.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.sql.SQLException;

//TAX_CATEGORY
@ApplicationScoped
public class VatCategoryRepository {

    private final Jdbc jdbc;

    @Inject
    public VatCategoryRepository(Jdbc jdbc) {
        this.jdbc = jdbc;
    }

    public boolean existsActiveSifrepdv(long korisnikId, long pdvId) throws SQLException {
        final String sql = """
                SELECT 1
                  FROM SIFREPDV
                 WHERE KORISNIK_ID = ?
                   AND PDV_ID = ?
                   AND AKTIVAN = 1
                """;
        Integer one = jdbc.queryOne(sql,
                ps -> { ps.setLong(1, korisnikId); ps.setLong(2, pdvId); },
                rs -> rs.getInt(1));
        return one != null;
    }
}

package hr.agape.document.repository;

import hr.agape.common.database.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.sql.SQLException;

//SKL_ARTIKLIG
@ApplicationScoped
public class DocumentItemRepository {

    private final Jdbc jdbc;

    @Inject
    public DocumentItemRepository(Jdbc jdbc) {
        this.jdbc = jdbc;
    }

    public boolean isMissingOrInactive(Long itemId) throws SQLException {
        final String sql = """
                SELECT 1
                  FROM SKL_ARTIKLIG
                 WHERE ARTIKL_ID = ?
                   AND NVL(AKTIVANARTIKL, 1) = 1
                """;

        Integer one = jdbc.queryOne(
                sql,
                ps -> ps.setLong(1, itemId),
                rs -> rs.getInt(1)
        );

        return one == null;
    }
}

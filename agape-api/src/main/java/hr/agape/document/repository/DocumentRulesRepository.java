package hr.agape.document.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;

@ApplicationScoped
public class DocumentRulesRepository {

    private final DataSource ds;

    @Inject
    public DocumentRulesRepository(@io.quarkus.agroal.DataSource("oracle") DataSource ds) {
        this.ds = ds;
    }

    public Optional<Integer> valueAddedTaxIdForDocumentId(int documentId) throws SQLException {
        final String sql =
                "SELECT s.PDV_ID " +
                        "  FROM SD_SIFREG r " +
                        "  JOIN SKLADISTE s ON s.SKLADISTE_ID = r.SKLADISTE_ID " +
                        " WHERE r.DOKUMENT_ID = ? " +
                        "   AND s.PDV_ID IS NOT NULL " +
                        "   AND ROWNUM = 1";

        try (Connection c = ds.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, documentId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return Optional.of(rs.getInt(1));
                return Optional.empty();
            }
        }
    }

}

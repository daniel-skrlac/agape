package hr.agape.document.lookup.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;

//SD_SIFREG + SKLADISTE join
@ApplicationScoped
public class DocumentVatLookupRepository {

    private final DataSource ds;

    @Inject
    public DocumentVatLookupRepository(@io.quarkus.agroal.DataSource("oracle") DataSource ds) {
        this.ds = ds;
    }

    public Optional<Long> valueAddedTaxIdForDocumentAndWarehouse(Long documentId, Long warehouseId)
            throws SQLException {

        final String sql = """
                SELECT s.PDV_ID
                  FROM SD_SIFREG r
                  JOIN SKLADISTE s ON s.SKLADISTE_ID = r.SKLADISTE_ID
                 WHERE r.DOKUMENT_ID = ?
                   AND r.SKLADISTE_ID = ?
                   AND s.PDV_ID IS NOT NULL
                   AND ROWNUM = 1
                """;

        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            ps.setLong(1, documentId);
            ps.setLong(2, warehouseId);

            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }

                long raw = rs.getLong("PDV_ID");
                if (rs.wasNull()) {
                    return Optional.empty();
                }

                return Optional.of(raw);
            }
        }
    }
}

package hr.agape.document.lookup.repository;

import hr.agape.document.lookup.view.DocumentItemAttributesView;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

//SKL_ARTIKLIG + SKL_ARTIKLIZ join
@ApplicationScoped
public class DocumentItemLookupRepository {

    private final DataSource ds;

    @Inject
    public DocumentItemLookupRepository(@io.quarkus.agroal.DataSource("oracle") DataSource ds) {
        this.ds = ds;
    }

    public Map<Long, DocumentItemAttributesView> findAttributes(Set<Long> itemIds) throws SQLException {
        String placeholders = itemIds.stream()
                .map(x -> "?")
                .collect(Collectors.joining(","));

        String sql = """
                SELECT g.ARTIKL_ID,
                       g.NAZIV_ID,
                       z.JMJ_ID
                  FROM SKL_ARTIKLIG g
                  JOIN SKL_ARTIKLIZ z ON z.ARTIKLIZ_ID = g.ARTIKLIZ_ID
                 WHERE g.ARTIKL_ID IN (%s)
                """.formatted(placeholders);

        Map<Long, DocumentItemAttributesView> out = new HashMap<>(itemIds.size());

        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            int i = 1;
            for (Long id : itemIds) {
                ps.setLong(i++, id);
            }

            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long itemIdRaw = rs.getLong("ARTIKL_ID");

                    long nameIdRaw = rs.getLong("NAZIV_ID");
                    Long nameId = rs.wasNull() ? null : nameIdRaw;

                    long uomIdRaw = rs.getLong("JMJ_ID");
                    Long unitOfMeasureId = rs.wasNull() ? null : uomIdRaw;

                    out.put(
                            itemIdRaw,
                            DocumentItemAttributesView.builder()
                                    .nameId(nameId)
                                    .unitOfMeasureId(unitOfMeasureId)
                                    .build()
                    );
                }
            }
        }

        return out;
    }
}

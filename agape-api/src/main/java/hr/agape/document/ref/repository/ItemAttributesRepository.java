package hr.agape.document.ref.repository;

import hr.agape.document.ref.domain.ItemAttributes;
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

@ApplicationScoped
public class ItemAttributesRepository {

    private final DataSource ds;

    @Inject
    public ItemAttributesRepository(@io.quarkus.agroal.DataSource("oracle") DataSource ds) {
        this.ds = ds;
    }

    public Map<Integer, ItemAttributes> findAttributes(Set<Integer> itemIds) throws SQLException {
        String placeholders = itemIds.stream().map(x -> "?").collect(Collectors.joining(","));
        String sql =
                "SELECT g.ARTIKL_ID, g.NAZIV_ID, z.JMJ_ID " +
                        "  FROM SKL_ARTIKLIG g " +
                        "  JOIN SKL_ARTIKLIZ z ON z.ARTIKLIZ_ID = g.ARTIKLIZ_ID " +
                        " WHERE g.ARTIKL_ID IN (" + placeholders + ")";

        Map<Integer, ItemAttributes> out = new HashMap<>(itemIds.size());
        try (Connection c = ds.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            int i = 1;
            for (Integer id : itemIds) ps.setInt(i++, id);

            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    int itemId = rs.getInt("ARTIKL_ID");

                    Number nNaziv = (Number) rs.getObject("NAZIV_ID");
                    Number nJmj = (Number) rs.getObject("JMJ_ID");
                    Integer nameId = (nNaziv != null) ? nNaziv.intValue() : null;
                    Integer unitOfMeasureId = (nJmj != null) ? nJmj.intValue() : null;

                    out.put(itemId, ItemAttributes.builder()
                            .nameId(nameId)
                            .unitOfMeasureId(unitOfMeasureId)
                            .build());
                }
            }
        }
        return out;
    }

}

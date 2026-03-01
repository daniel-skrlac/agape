package hr.agape.document.repository;

import hr.agape.document.domain.DocumentItemPriceEntity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
public class DocumentItemPriceRepository {

    @Inject
    @io.quarkus.agroal.DataSource("oracle")
    DataSource dataSource;

    /**
     * Fetch PDV_ID (and optionally prices) from SKL_ACIJENE for a set of ARTIKL_IDs.
     */
    public List<DocumentItemPriceEntity> findPrices(Set<Long> itemIds) throws SQLException {
        if (itemIds == null || itemIds.isEmpty()) return List.of();

        String placeholders = itemIds.stream().map(x -> "?").collect(Collectors.joining(","));

        String sql = """
                SELECT ARTIKL_ID,
                       PDV_ID,
                       CIJENAFAK,
                       CIJENANAB,
                       CIJENAMP,
                       CIJENAJEDINICE
                  FROM SKL_ACIJENE
                 WHERE ARTIKL_ID IN (%s)
                """.formatted(placeholders);

        List<DocumentItemPriceEntity> out = new ArrayList<>(itemIds.size());

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            int i = 1;
            for (Long id : itemIds) ps.setLong(i++, id);

            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Long itemId = rs.getLong("ARTIKL_ID");
                    if (rs.wasNull()) continue;

                    Long pdvId = rs.getLong("PDV_ID");
                    if (rs.wasNull()) pdvId = null;

                    BigDecimal cijenaFak = rs.getBigDecimal("CIJENAFAK");
                    BigDecimal cijenaNab = rs.getBigDecimal("CIJENANAB");
                    BigDecimal cijenaMp = rs.getBigDecimal("CIJENAMP");
                    BigDecimal cijenaJed = rs.getBigDecimal("CIJENAJEDINICE");

                    out.add(DocumentItemPriceEntity.builder()
                            .itemId(itemId)
                            .pdvId(pdvId)
                            .priceFak(cijenaFak)
                            .priceNab(cijenaNab)
                            .priceMp(cijenaMp)
                            .priceJedinice(cijenaJed)
                            .build());
                }
            }
        }

        return out;
    }
}

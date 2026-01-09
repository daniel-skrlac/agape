package hr.agape.document.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;

@ApplicationScoped
public class MkBookingRepository {

    private final DataSource dataSource;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public MkBookingRepository(@io.quarkus.agroal.DataSource("oracle") DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Transactional(Transactional.TxType.NOT_SUPPORTED)
    public void knjiziMkDokument(
            Long sdGlavaId,
            String oibDigits,
            int knjizitiNaSkladiste,
            int knjizitiUKPopisa,
            int knjizitiNormative,
            int generirajZapisnik,
            int azuriratiProdajneCijene,
            int azuriratiNabavneCijene
    ) throws Exception {

        BigDecimal oibNum = toOibNumber(oibDigits);

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(
                     "BEGIN KNJIZI_MK.KNJIZI_MK_DOKUMENT(" +
                             " :p_id, :p_oib, :p_sklad, :p_kpop, :p_norm, :p_zap, :p_prod, :p_nab" +
                             "); END;"
             )) {

            ps.setLong(1, sdGlavaId);
            ps.setBigDecimal(2, oibNum);
            ps.setInt(3, knjizitiNaSkladiste);
            ps.setInt(4, knjizitiUKPopisa);
            ps.setInt(5, knjizitiNormative);
            ps.setInt(6, generirajZapisnik);
            ps.setInt(7, azuriratiProdajneCijene);
            ps.setInt(8, azuriratiNabavneCijene);

            ps.executeUpdate();
        }
    }

    private BigDecimal toOibNumber(String oib) {
        if (oib == null) throw new IllegalArgumentException("OIB is null");
        String digits = oib.replaceAll("[^0-9]", "");
        if (digits.length() != 11) throw new IllegalArgumentException("OIB must have 11 digits: " + oib);
        return new BigDecimal(digits);
    }
}

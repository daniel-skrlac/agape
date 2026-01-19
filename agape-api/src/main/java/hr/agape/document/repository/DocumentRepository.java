package hr.agape.document.repository;

import hr.agape.common.database.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.sql.CallableStatement;
import java.sql.SQLException;

@ApplicationScoped
public class DocumentRepository {

    private static final Logger LOG = Logger.getLogger(DocumentRepository.class);

    private final Jdbc jdbc;

    @Inject
    public DocumentRepository(Jdbc jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Calls PL/SQL posting procedure OUTSIDE any Java transaction.
     * The procedure commits/rolls back internally (legacy behavior).
     */
    public void bookDocument(
            Long sdGlavaId,
            String actorOibDigits,
            int knjizitiNaSkladiste,
            int knjizitiUkPopisa,
            int knjizitiNormative,
            int generirajZapisnik,
            int azurirajProdajne,
            int azurirajNabavne
    ) throws SQLException {

        String lockName = "SD_GLAVA:" + sdGlavaId;
        jdbc.withExclusiveLock(lockName, 30, c -> {
            try (CallableStatement cs = c.prepareCall("{ call KNJIZI_MK.KNJIZI_MK_DOKUMENT(?,?,?,?,?,?,?,?) }")) {
                cs.setLong(1, sdGlavaId);

                try (CallableStatement cs0 = c.prepareCall("{ call GLO.OPERATER(?) }")) {
                    cs0.setLong(1, Long.parseLong(actorOibDigits));
                    cs0.execute();
                }

                try {
                    cs.setLong(2, Long.parseLong(actorOibDigits));
                } catch (NumberFormatException nfe) {
                    cs.setString(2, actorOibDigits);
                }

                cs.setInt(3, knjizitiNaSkladiste);
                cs.setInt(4, knjizitiUkPopisa);
                cs.setInt(5, knjizitiNormative);
                cs.setInt(6, generirajZapisnik);
                cs.setInt(7, azurirajProdajne);
                cs.setInt(8, azurirajNabavne);

                cs.execute();
            }
        });
    }

    /**
     * REAL storno/cancel in Oracle. This should reverse inventory/warehouse effects.
     * This calls:
     * STORNO_MK.STORNO_MK_DOKUMENT(
     * p_id,
     * p_StornoNaSkladiste,
     * p_StornoUKPopisa,
     * p_StornoVeznid,
     * p_PostaviOznaku
     * )
     */
    public void cancelDocument(
            Long headerId,
            int stornoNaSkladiste,
            int stornoUKPopisa,
            int stornoVeznid,
            int postaviOznaku
    ) throws SQLException {

        String lockName = "SD_GLAVA:" + headerId;
        jdbc.withExclusiveLock(lockName, 30, c -> {
            try (CallableStatement cs = c.prepareCall("{ call STORNO_MK.STORNO_MK_DOKUMENT(?,?,?,?,?) }")) {
                cs.setLong(1, headerId);
                cs.setInt(2, stornoNaSkladiste);
                cs.setInt(3, stornoUKPopisa);
                cs.setInt(4, stornoVeznid);
                cs.setInt(5, postaviOznaku);
                cs.execute();
            }
        });
    }
}

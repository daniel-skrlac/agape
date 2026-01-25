package hr.agape.document.repository;

import hr.agape.common.database.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.SQLException;

@ApplicationScoped
public class DocumentRepository {

    private static final Logger LOG = Logger.getLogger(DocumentRepository.class);

    private final Jdbc jdbc;

    @Inject
    public DocumentRepository(Jdbc jdbc) {
        this.jdbc = jdbc;
    }

    public void initLegacyContext(Connection c, Long dokumentId, String operatorOibDigits) throws SQLException {
        final String plsql = """
                BEGIN
                  KNJIZI_MK.CITAJ_GLOBALNO(?);
                  GLO.DOKUMENT_ID := ?;
                  GLO.OPERATER(?);
                EXCEPTION
                  WHEN OTHERS THEN
                    RAISE;
                END;
                """;

        try (CallableStatement cs = c.prepareCall(plsql)) {
            cs.setLong(1, dokumentId);
            cs.setLong(2, dokumentId);
            try {
                cs.setLong(3, Long.parseLong(operatorOibDigits));
            } catch (NumberFormatException nfe) {
                cs.setString(3, operatorOibDigits);
            }
            cs.execute();
        }
    }

    public void recalcHeader(Long sdGlavaId) throws SQLException {
        String lockName = "SD_GLAVA:" + sdGlavaId;
        jdbc.withExclusiveLock(lockName, 30, c -> {
            try (CallableStatement cs = c.prepareCall("{ call AGAPE_API.RECALC_SD_GLAVA(?) }")) {
                cs.setLong(1, sdGlavaId);
                cs.execute();
            }
        });
    }

    public void recalcHeaderTmp(Long sdGlavaId) throws SQLException {
        String lockName = "SD_GLAVA:" + sdGlavaId;
        jdbc.withExclusiveLock(lockName, 30, c -> {
            try (CallableStatement cs = c.prepareCall("{ call AGAPE_API.RECALC_SD_GLAVA_TMP(?) }")) {
                cs.setLong(1, sdGlavaId);
                cs.execute();
            }
        });
    }

    /**
     * Calls PL/SQL posting procedure OUTSIDE any Java transaction.
     * The procedure commits/rolls back internally (legacy behavior).
     */
    public void bookDocument(
            Long sdGlavaId,
            Long documentId,
            String operatorOibDigits,
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

                initLegacyContext(c, documentId, operatorOibDigits);

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

    /**
     * Run recalculation in the SAME Oracle session/transaction (same Connection).
     * This is critical if legacy logic depends on session state / GLO context / temporary tables.
     */
    public void recalcHeaderTmp(Connection c, Long sdGlavaId) throws SQLException {
        try (CallableStatement cs = c.prepareCall("{ call AGAPE_API.RECALC_SD_GLAVA_TMP(?) }")) {
            cs.setLong(1, sdGlavaId);
            cs.execute();
        }
    }

    /**
     * Full recalc in the same session.
     */
    public void recalcHeader(Connection c, Long sdGlavaId) throws SQLException {
        try (CallableStatement cs = c.prepareCall("{ call AGAPE_API.RECALC_SD_GLAVA(?) }")) {
            cs.setLong(1, sdGlavaId);
            cs.execute();
        }
    }
}

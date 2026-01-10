package hr.agape.document.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import javax.sql.DataSource;
import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.SQLException;

@ApplicationScoped
public class DocumentRepository {

    private static final Logger LOG = Logger.getLogger(DocumentRepository.class);

    private final DataSource dataSource;

    @Inject
    public DocumentRepository(@io.quarkus.agroal.DataSource("oracle") DataSource dataSource) {
        this.dataSource = dataSource;
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
        try (Connection c = dataSource.getConnection()) {
            boolean prevAutoCommit = c.getAutoCommit();
            c.setAutoCommit(true);

            try (CallableStatement cs = c.prepareCall("{ call KNJIZI_MK.KNJIZI_MK_DOKUMENT(?,?,?,?,?,?,?,?,?) }")) {
                cs.setLong(1, sdGlavaId);

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
            } finally {
                c.setAutoCommit(prevAutoCommit);
            }
        }
    }
}

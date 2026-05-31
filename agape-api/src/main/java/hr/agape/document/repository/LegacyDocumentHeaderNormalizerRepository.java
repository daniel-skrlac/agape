package hr.agape.document.repository;

import jakarta.enterprise.context.ApplicationScoped;

import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.SQLException;

@ApplicationScoped
public class LegacyDocumentHeaderNormalizerRepository {

    /**
     * Minimal normalization only.
     * <p>
     * Do not calculate VAT buckets or force IZNOSKP here.
     * Those values must come from old Oracle logic for the resolved DOKUMENT_ID.
     */
    public void normalizeDispatchHeader(Connection c, Long headerId) throws SQLException {
        if (headerId == null) {
            throw new SQLException("Cannot normalize legacy SD_GLAVA: headerId is null.");
        }

        final String plsql = """
                BEGIN
                  UPDATE SD_STAVKE
                     SET CIJENAFAK1 = 0,
                         IZNOSFAK1 = 0
                   WHERE SD_GLAVA_ID = ?;
                
                  UPDATE SD_GLAVA
                     SET BROJJEDINICAV = NVL(BROJJEDINICAV, 1),
                         MARZASTOPA = NVL(MARZASTOPA, 0),
                         RABATSTOPA = NVL(RABATSTOPA, 0),
                         IZNOSFAK1 = 0
                   WHERE ID = ?;
                
                  IF SQL%ROWCOUNT <> 1 THEN
                    RAISE_APPLICATION_ERROR(-20020, 'SD_GLAVA normalization failed. ID=' || ?);
                  END IF;
                END;
                """;

        try (CallableStatement cs = c.prepareCall(plsql)) {
            cs.setLong(1, headerId);
            cs.setLong(2, headerId);
            cs.setLong(3, headerId);
            cs.execute();
        }
    }
}

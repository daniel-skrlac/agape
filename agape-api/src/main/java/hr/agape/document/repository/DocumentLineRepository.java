package hr.agape.document.repository;

import hr.agape.common.database.Jdbc;
import hr.agape.document.dto.DocumentItemLineDTO;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.util.List;

@ApplicationScoped
public class DocumentLineRepository {

    private final Jdbc jdbc;

    @Inject
    public DocumentLineRepository(Jdbc jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(Long headerId, List<DocumentItemLineDTO> lines) throws SQLException {
        jdbc.withConnectionVoid(c -> insert(c, headerId, lines));
    }

    public void insert(Connection c, Long headerId, List<DocumentItemLineDTO> lines) throws SQLException {
        if (lines == null || lines.isEmpty()) return;

        final String lockHeaderSql = "SELECT 1 FROM SD_GLAVA WHERE ID = ? FOR UPDATE";
        final String maxLineSql = "SELECT NVL(MAX(STAVKABR), 0) FROM SD_STAVKE WHERE SD_GLAVA_ID = ?";
        final String insertSql = """
                INSERT INTO SD_STAVKE
                  (ID, SD_GLAVA_ID, ARTIKL_ID, KOLICINA, STAVKABR,
                   NAZIV_ID, PDV_ID, JMJ_ID,
                   ROBA, USLUGA, MAKROARTIKL, JAMSTVODOBAVLJAC, JAMSTVOKUPAC,
                   ZALIHATRENUTNA, CIJENAFAK, RABATSTOPA, CIJENAFAK1, CIJENANAB, CIJENANAB_, CIJENAZA,
                   MARZASTOPA, CIJENABP, CIJENASP, CIJENAPN, CIJENAMP, CIJENAKP,
                   KOLICINAUPAKOVANJU, BRUTO, NETO, JMJBRUTONETO, CIJENAJEDINICE,
                   SIFRAVALUTE, VALUTA, BROJJEDINICAV, TECAJ, CIJENAFAK_V,
                   IZNOSFAK_V, KNJIZENO, STORNO, PLACENO, IZMJENJENACIJENA,
                   IZRADIO, IZMIJENIO, NAPLATIO, TAGFLAG)
                SELECT SD_STAVKE_SEQ.NEXTVAL, ?, s.ID, ?, ?,
                       COALESCE(?, s.NAZIV_ID), COALESCE(?, s.PDV_ID), COALESCE(?, s.JMJ_ID),
                       NVL(s.ROBA, 0), NVL(s.USLUGA, 0), NVL(s.MAKROARTIKL, 0),
                       s.JAMSTVODOBAVLJAC, s.JAMSTVOKUPAC,
                       0, ROUND(NVL(s.CIJENAFAK, 0), 2), 0, NVL(s.CIJENAFAK1, 0),
                       NVL(s.CIJENANAB, 0), NVL(s.CIJENANAB_, NVL(s.CIJENANAB, 0)),
                       NVL(NULLIF(s.CIJENAZA, 0), 1), 0, ROUND(NVL(s.CIJENABP, 0), 2),
                       ROUND(NVL(s.CIJENASP, 0), 2), ROUND(NVL(s.CIJENAPN, 0), 2),
                       ROUND(NVL(s.CIJENAMP, 0), 2), ROUND(NVL(s.CIJENAKP, 0), 2),
                       NVL(NULLIF(s.KOLICINAUPAKOVANJU, 0), 1), s.BRUTO, s.NETO,
                       s.JMJBRUTONETO, s.CIJENAJEDINICE,
                       '   ', '   ', 1, 0, 0,
                       0, 0, 0, 0, 0,
                       GLO.GET_OIB_OPERATERA(), 0, 0, 0
                  FROM SKLADISTE s
                 WHERE s.ID = ?
                   AND s.CJENIK_ID = 1
                """;

        try (PreparedStatement lock = c.prepareStatement(lockHeaderSql)) {
            lock.setLong(1, headerId);
            lock.executeQuery().close();
        }

        long start;
        try (PreparedStatement ps = c.prepareStatement(maxLineSql)) {
            ps.setLong(1, headerId);
            try (var rs = ps.executeQuery()) {
                rs.next();
                start = rs.getLong(1);
            }
        }

        try (PreparedStatement ps = c.prepareStatement(insertSql)) {
            long lineNo = start + 1;

            for (DocumentItemLineDTO pl : lines) {
                if (pl.getItemId() == null) {
                    throw new SQLException("Cannot insert SD_STAVKE: ARTIKL_ID is null.");
                }

                ps.setLong(1, headerId);

                if (pl.getQuantity() != null) ps.setObject(2, pl.getQuantity(), Types.NUMERIC);
                else ps.setNull(2, Types.NUMERIC);

                ps.setLong(3, lineNo++);

                if (pl.getNameId() != null) ps.setObject(4, pl.getNameId(), Types.NUMERIC);
                else ps.setNull(4, Types.NUMERIC);

                if (pl.getValueAddedTaxId() != null) ps.setObject(5, pl.getValueAddedTaxId(), Types.NUMERIC);
                else ps.setNull(5, Types.NUMERIC);

                if (pl.getUnitOfMeasureId() != null) ps.setObject(6, pl.getUnitOfMeasureId(), Types.NUMERIC);
                else ps.setNull(6, Types.NUMERIC);

                ps.setLong(7, pl.getItemId());

                ps.addBatch();
            }

            int[] results = ps.executeBatch();
            for (int i = 0; i < results.length; i++) {
                if (results[i] == 0 || results[i] == Statement.EXECUTE_FAILED) {
                    throw new SQLException(
                            "Cannot insert SD_STAVKE: article is missing from the selected warehouse price list. "
                                    + "ARTIKL_ID=" + lines.get(i).getItemId()
                    );
                }
            }
        }
    }

    public void deleteByHeader(Connection c, Long headerId) throws SQLException {
        final String sql = "DELETE FROM SD_STAVKE WHERE SD_GLAVA_ID = ?";
        jdbc.update(c, sql, ps -> ps.setLong(1, headerId));
    }

    public void deleteByHeader(Long headerId) throws SQLException {
        final String sql = "DELETE FROM SD_STAVKE WHERE SD_GLAVA_ID = ?";
        jdbc.update(sql, ps -> ps.setLong(1, headerId));
    }
}

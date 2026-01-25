package hr.agape.document.repository;

import hr.agape.common.database.Jdbc;
import hr.agape.document.lookup.view.DocumentSlotTypeView;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class DocumentTypeRepository {

    private final Jdbc jdbc;

    @Inject
    public DocumentTypeRepository(Jdbc jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<DocumentSlotTypeView> findDocumentSlot(Long documentId) throws SQLException {
        final String sql = """
                    SELECT *
                    FROM (
                        SELECT
                            r.DOKUMENT_ID,
                            z.SD_SIFREZ_ID,
                            z.DOKUMENTID,
                            z.NAZIVDOKUMENTA,
                            z.ULAZIZLAZ,
                            z.MIJENJAZALIHU,
                            z.KNJIZITINASKLADISTE,
                            z.KNJIZITIUKPOPISA,
                            z.KNJIZITINORMATIVE,
                            z.KNJIZITISASTAVNICU,
                            z.TIPPRODAJNIHCIJENA,
                            z.TIPNABAVNECIJENE,
                            z.TIPKNJIGEPOPISA,
                            z.TIPKARTICE,
                            z.TIPBAZA
                        FROM SD_SIFREG r
                        JOIN SD_SIFREZ z ON z.SD_SIFREZ_ID = r.SD_SIFREZ_ID
                        WHERE r.DOKUMENT_ID = ?
                    )
                    WHERE ROWNUM = 1
                """;

        DocumentSlotTypeView view = jdbc.queryOne(
                sql,
                ps -> ps.setLong(1, documentId),
                rs -> DocumentSlotTypeView.builder()
                        .documentId(rs.getInt("DOKUMENT_ID"))
                        .sdSifrezId(rs.getInt("SD_SIFREZ_ID"))
                        .documentCode(rs.getString("DOKUMENTID"))
                        .displayName(rs.getString("NAZIVDOKUMENTA"))
                        .inOutFlag(rs.getInt("ULAZIZLAZ"))
                        .changesStock(rs.getInt("MIJENJAZALIHU"))
                        .knjizitiNaSkladiste(rs.getInt("KNJIZITINASKLADISTE"))
                        .knjizitiUkPopisa(rs.getInt("KNJIZITIUKPOPISA"))
                        .knjizitiNormative(rs.getInt("KNJIZITINORMATIVE"))
                        .knjizitiSastavnicu(rs.getInt("KNJIZITISASTAVNICU"))
                        .tipProdajnihCijena(rs.getInt("TIPPRODAJNIHCIJENA"))
                        .tipNabavneCijene(rs.getInt("TIPNABAVNECIJENE"))
                        .tipKnjigePopisa(rs.getInt("TIPKNJIGEPOPISA"))
                        .tipKartice(rs.getInt("TIPKARTICE"))
                        .tipBaza(rs.getInt("TIPBAZA"))
                        .build()
        );

        return Optional.ofNullable(view);
    }

    public long countDistinctDocumentIds() throws SQLException {
        final String sql = "SELECT COUNT(*) FROM (SELECT DISTINCT DOKUMENT_ID FROM SD_SIFREG)";

        Long cnt = jdbc.queryOne(sql, null, rs -> rs.getLong(1));
        return (cnt == null) ? 0L : cnt;
    }

    public List<DocumentSlotTypeView> pageDocumentSlots(int offset, int limit) throws SQLException {
        final String sql = """
                    WITH dids AS (
                      SELECT DISTINCT r.DOKUMENT_ID AS DID
                        FROM SD_SIFREG r
                    ),
                    ranked AS (
                      SELECT d.DID,
                             ROW_NUMBER() OVER (ORDER BY d.DID) AS rn
                        FROM dids d
                    )
                    SELECT r2.DOKUMENT_ID,
                           z.SD_SIFREZ_ID,
                           z.DOKUMENTID,
                           z.NAZIVDOKUMENTA,
                           z.ULAZIZLAZ,
                           z.MIJENJAZALIHU,
                           z.KNJIZITINASKLADISTE,
                           z.KNJIZITIUKPOPISA,
                           z.KNJIZITINORMATIVE,
                           z.KNJIZITISASTAVNICU,
                           z.TIPPRODAJNIHCIJENA,
                           z.TIPNABAVNECIJENE,
                           z.TIPKNJIGEPOPISA,
                           z.TIPKARTICE,
                           z.TIPBAZA
                      FROM ranked x
                      JOIN SD_SIFREG r2 ON r2.DOKUMENT_ID = x.DID
                      JOIN SD_SIFREZ  z  ON z.SD_SIFREZ_ID = r2.SD_SIFREZ_ID
                     WHERE x.rn BETWEEN ? AND ?
                       AND r2.SD_SIFREZ_ID = (
                            SELECT MIN(r3.SD_SIFREZ_ID)
                              FROM SD_SIFREG r3
                             WHERE r3.DOKUMENT_ID = x.DID
                       )
                     ORDER BY r2.DOKUMENT_ID
                """;

        int start = offset + 1;
        int end = offset + limit;

        return jdbc.query(
                sql,
                ps -> {
                    ps.setInt(1, start);
                    ps.setInt(2, end);
                },
                rs -> DocumentSlotTypeView.builder()
                        .documentId(rs.getInt("DOKUMENT_ID"))
                        .sdSifrezId(rs.getInt("SD_SIFREZ_ID"))
                        .documentCode(rs.getString("DOKUMENTID"))
                        .displayName(rs.getString("NAZIVDOKUMENTA"))
                        .inOutFlag(rs.getInt("ULAZIZLAZ"))
                        .changesStock(rs.getInt("MIJENJAZALIHU"))
                        .knjizitiNaSkladiste(rs.getInt("KNJIZITINASKLADISTE"))
                        .knjizitiUkPopisa(rs.getInt("KNJIZITIUKPOPISA"))
                        .knjizitiNormative(rs.getInt("KNJIZITINORMATIVE"))
                        .knjizitiSastavnicu(rs.getInt("KNJIZITISASTAVNICU"))
                        .tipProdajnihCijena(rs.getInt("TIPPRODAJNIHCIJENA"))
                        .tipNabavneCijene(rs.getInt("TIPNABAVNECIJENE"))
                        .tipKnjigePopisa(rs.getInt("TIPKNJIGEPOPISA"))
                        .tipKartice(rs.getInt("TIPKARTICE"))
                        .tipBaza(rs.getInt("TIPBAZA"))
                        .build()
        );
    }

    public long countDistinctDocumentIdsFiltered(String q) throws SQLException {
        final String sql = """
                    SELECT COUNT(*) FROM (
                        SELECT DISTINCT r.DOKUMENT_ID
                        FROM SD_SIFREG r
                        JOIN SD_SIFREZ z ON z.SD_SIFREZ_ID = r.SD_SIFREZ_ID
                        WHERE LOWER(z.NAZIVDOKUMENTA) LIKE ?
                           OR LOWER(z.DOKUMENTID) LIKE ?
                           OR TO_CHAR(r.DOKUMENT_ID) LIKE ?
                    )
                """;

        String like = "%" + q.toLowerCase().trim() + "%";

        Long cnt = jdbc.queryOne(
                sql,
                ps -> {
                    ps.setString(1, like);
                    ps.setString(2, like);
                    ps.setString(3, like);
                },
                rs -> rs.getLong(1)
        );

        return (cnt == null) ? 0L : cnt;
    }

    public List<DocumentSlotTypeView> pageDocumentSlotsFiltered(int offset, int limit, String q) throws SQLException {
        final String sql = """
                    WITH dids AS (
                      SELECT DISTINCT r.DOKUMENT_ID AS DID
                        FROM SD_SIFREG r
                        JOIN SD_SIFREZ z ON z.SD_SIFREZ_ID = r.SD_SIFREZ_ID
                       WHERE LOWER(z.NAZIVDOKUMENTA) LIKE ?
                          OR LOWER(z.DOKUMENTID) LIKE ?
                          OR TO_CHAR(r.DOKUMENT_ID) LIKE ?
                    ),
                    ranked AS (
                      SELECT d.DID,
                             ROW_NUMBER() OVER (ORDER BY d.DID) AS rn
                        FROM dids d
                    )
                    SELECT r2.DOKUMENT_ID,
                           z.SD_SIFREZ_ID,
                           z.DOKUMENTID,
                           z.NAZIVDOKUMENTA,
                           z.ULAZIZLAZ,
                           z.MIJENJAZALIHU,
                           z.KNJIZITINASKLADISTE,
                           z.KNJIZITIUKPOPISA,
                           z.KNJIZITINORMATIVE,
                           z.KNJIZITISASTAVNICU,
                           z.TIPPRODAJNIHCIJENA,
                           z.TIPNABAVNECIJENE,
                           z.TIPKNJIGEPOPISA,
                           z.TIPKARTICE,
                           z.TIPBAZA
                      FROM ranked x
                      JOIN SD_SIFREG r2 ON r2.DOKUMENT_ID = x.DID
                      JOIN SD_SIFREZ  z  ON z.SD_SIFREZ_ID = r2.SD_SIFREZ_ID
                     WHERE x.rn BETWEEN ? AND ?
                       AND r2.SD_SIFREZ_ID = (
                            SELECT MIN(r3.SD_SIFREZ_ID)
                              FROM SD_SIFREG r3
                             WHERE r3.DOKUMENT_ID = x.DID
                       )
                     ORDER BY r2.DOKUMENT_ID
                """;

        String like = "%" + q.toLowerCase().trim() + "%";
        int start = offset + 1;
        int end = offset + limit;

        return jdbc.query(
                sql,
                ps -> {
                    ps.setString(1, like);
                    ps.setString(2, like);
                    ps.setString(3, like);
                    ps.setInt(4, start);
                    ps.setInt(5, end);
                },
                rs -> DocumentSlotTypeView.builder()
                        .documentId(rs.getInt("DOKUMENT_ID"))
                        .sdSifrezId(rs.getInt("SD_SIFREZ_ID"))
                        .documentCode(rs.getString("DOKUMENTID"))
                        .displayName(rs.getString("NAZIVDOKUMENTA"))
                        .inOutFlag(rs.getInt("ULAZIZLAZ"))
                        .changesStock(rs.getInt("MIJENJAZALIHU"))
                        .knjizitiNaSkladiste(rs.getInt("KNJIZITINASKLADISTE"))
                        .knjizitiUkPopisa(rs.getInt("KNJIZITIUKPOPISA"))
                        .knjizitiNormative(rs.getInt("KNJIZITINORMATIVE"))
                        .knjizitiSastavnicu(rs.getInt("KNJIZITISASTAVNICU"))
                        .tipProdajnihCijena(rs.getInt("TIPPRODAJNIHCIJENA"))
                        .tipNabavneCijene(rs.getInt("TIPNABAVNECIJENE"))
                        .tipKnjigePopisa(rs.getInt("TIPKNJIGEPOPISA"))
                        .tipKartice(rs.getInt("TIPKARTICE"))
                        .tipBaza(rs.getInt("TIPBAZA"))
                        .build()
        );
    }
}

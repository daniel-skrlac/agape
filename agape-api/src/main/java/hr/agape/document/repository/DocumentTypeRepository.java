package hr.agape.document.repository;

import hr.agape.common.database.Jdbc;
import hr.agape.document.lookup.view.DocumentSlotTypeView;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

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
                            z.REZERVACIJE,
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
                        .rezervacije(rs.getInt("REZERVACIJE"))
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

    public Optional<DocumentSlotTypeView> findDocumentSlotByCodeAndWarehouse(Long warehouseId, String documentCode) throws SQLException {
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
                        JOIN SD_SIFREZ z
                          ON z.SD_SIFREZ_ID = r.SD_SIFREZ_ID
                       WHERE r.SKLADISTE_ID = ?
                         AND TRIM(UPPER(z.DOKUMENTID)) = TRIM(UPPER(?))
                       ORDER BY r.DOKUMENT_ID ASC, z.SD_SIFREZ_ID ASC
                       )
                 WHERE ROWNUM = 1
                """;

        DocumentSlotTypeView view = jdbc.queryOne(
                sql,
                ps -> {
                    ps.setLong(1, warehouseId);
                    ps.setString(2, documentCode);
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

        return Optional.ofNullable(view);
    }

    public List<DocumentSlotTypeView> listDocumentSlots(
            Long warehouseId,
            String q,
            List<String> excludeCodes,
            Set<Long> excludeDocumentIds
    ) throws SQLException {

        final boolean hasQ = q != null && !q.isBlank();

        final List<String> exCodes = (excludeCodes == null) ? List.of()
                : excludeCodes.stream()
                .map(s -> (s == null) ? "" : s.trim().toUpperCase())
                .filter(s -> !s.isBlank())
                .distinct()
                .toList();

        final List<Long> exIds = (excludeDocumentIds == null) ? List.of()
                : excludeDocumentIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        final boolean hasExcludeCodes = !exCodes.isEmpty();
        final boolean hasExcludeIds = !exIds.isEmpty();

        // helper for IN (?, ?, ?)
        final java.util.function.IntFunction<String> placeholders = (n) -> {
            if (n <= 0) return "";
            return String.join(",", java.util.Collections.nCopies(n, "?"));
        };

        String sql = """
                WITH dids AS (
                    SELECT DISTINCT r.DOKUMENT_ID AS DID
                    FROM SD_SIFREG r
                    JOIN SD_SIFREZ z ON z.SD_SIFREZ_ID = r.SD_SIFREZ_ID
                    WHERE ( ? IS NULL OR r.SKLADISTE_ID = ? )
                      AND (
                           ? IS NULL OR ? = '' OR
                           LOWER(z.NAZIVDOKUMENTA) LIKE ? OR
                           LOWER(z.DOKUMENTID) LIKE ? OR
                           TO_CHAR(r.DOKUMENT_ID) LIKE ?
                      )
                """;

        if (hasExcludeCodes) {
            // exclude by document code (z.DOKUMENTID)
            sql += "\n  AND UPPER(z.DOKUMENTID) NOT IN (" + placeholders.apply(exCodes.size()) + ")\n";
        }

        if (hasExcludeIds) {
            // exclude by documentId (r.DOKUMENT_ID)
            sql += "\n  AND r.DOKUMENT_ID NOT IN (" + placeholders.apply(exIds.size()) + ")\n";
        }

        sql += """
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
                  FROM dids x
                  JOIN SD_SIFREG r2 ON r2.DOKUMENT_ID = x.DID
                  JOIN SD_SIFREZ  z  ON z.SD_SIFREZ_ID = r2.SD_SIFREZ_ID
                 WHERE ( ? IS NULL OR r2.SKLADISTE_ID = ? )
                   AND r2.SD_SIFREZ_ID = (
                        SELECT MIN(r3.SD_SIFREZ_ID)
                          FROM SD_SIFREG r3
                         WHERE r3.DOKUMENT_ID = x.DID
                           AND ( ? IS NULL OR r3.SKLADISTE_ID = ? )
                   )
                 ORDER BY LOWER(z.NAZIVDOKUMENTA), r2.DOKUMENT_ID
                """;

        final String like = hasQ ? "%" + q.toLowerCase().trim() + "%" : null;
        final String qq = hasQ ? q.trim() : null;

        return jdbc.query(
                sql,
                ps -> {
                    int i = 1;

                    // dids WHERE: warehouse
                    ps.setObject(i++, warehouseId);
                    ps.setObject(i++, warehouseId);

                    // dids WHERE: q
                    ps.setString(i++, qq);
                    ps.setString(i++, qq);
                    ps.setString(i++, like);
                    ps.setString(i++, like);
                    ps.setString(i++, like);

                    // dids WHERE: excludeCodes
                    if (hasExcludeCodes) {
                        for (String c : exCodes) ps.setString(i++, c);
                    }

                    // dids WHERE: excludeDocumentIds
                    if (hasExcludeIds) {
                        for (Long id : exIds) ps.setLong(i++, id);
                    }

                    // outer WHERE: warehouse filter again (important because r2 join expands dids)
                    ps.setObject(i++, warehouseId);
                    ps.setObject(i++, warehouseId);

                    // MIN subquery warehouse again
                    ps.setObject(i++, warehouseId);
                    ps.setObject(i++, warehouseId);
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

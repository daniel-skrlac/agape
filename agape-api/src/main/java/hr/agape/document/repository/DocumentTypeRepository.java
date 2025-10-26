package hr.agape.document.repository;

import hr.agape.document.lookup.view.DocumentSlotTypeView;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

//SD_SIFREZ
@ApplicationScoped
public class DocumentTypeRepository {

    private final DataSource dataSource;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public DocumentTypeRepository(@io.quarkus.agroal.DataSource("oracle") DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public Optional<DocumentSlotTypeView> findDocumentSlot(int documentId) throws SQLException {
        final String sql = """
                    SELECT *
                    FROM (
                        SELECT
                            r.DOKUMENT_ID,
                            z.DOKUMENTID,
                            z.NAZIVDOKUMENTA,
                            z.ULAZIZLAZ,
                            z.MIJENJAZALIHU
                        FROM SD_SIFREG r
                        JOIN SD_SIFREZ z ON z.SD_SIFREZ_ID = r.SD_SIFREZ_ID
                        WHERE r.DOKUMENT_ID = ?
                    )
                    WHERE ROWNUM = 1
                """;

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            ps.setInt(1, documentId);

            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return Optional.empty();

                return Optional.of(
                        DocumentSlotTypeView.builder()
                                .documentId(rs.getInt("DOKUMENT_ID"))
                                .documentCode(rs.getString("DOKUMENTID"))
                                .displayName(rs.getString("NAZIVDOKUMENTA"))
                                .inOutFlag(rs.getInt("ULAZIZLAZ"))
                                .changesStock(rs.getInt("MIJENJAZALIHU"))
                                .build()
                );
            }
        }
    }

    public long countDistinctDocumentIds() throws SQLException {
        final String sql = "SELECT COUNT(*) FROM (SELECT DISTINCT DOKUMENT_ID FROM SD_SIFREG)";
        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            rs.next();
            return rs.getLong(1);
        }
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
                           z.DOKUMENTID,
                           z.NAZIVDOKUMENTA,
                           z.ULAZIZLAZ,
                           z.MIJENJAZALIHU
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

        List<DocumentSlotTypeView> out = new ArrayList<>(limit);

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            ps.setInt(1, start);
            ps.setInt(2, end);

            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(
                            DocumentSlotTypeView.builder()
                                    .documentId(rs.getInt("DOKUMENT_ID"))
                                    .documentCode(rs.getString("DOKUMENTID"))
                                    .displayName(rs.getString("NAZIVDOKUMENTA"))
                                    .inOutFlag(rs.getInt("ULAZIZLAZ"))
                                    .changesStock(rs.getInt("MIJENJAZALIHU"))
                                    .build()
                    );
                }
            }
        }

        return out;
    }
}

package hr.agape.document.repository;

import hr.agape.common.database.Jdbc;
import hr.agape.document.dto.DocumentItemLineDTO;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
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
                  (ID, SD_GLAVA_ID, ARTIKL_ID, KOLICINA, STAVKABR, NAZIV_ID, PDV_ID, JMJ_ID)
                VALUES
                  (SD_STAVKE_SEQ.NEXTVAL, ?, ?, ?, ?, ?, ?, ?)
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
                ps.setLong(1, headerId);

                if (pl.getItemId() != null) ps.setObject(2, pl.getItemId(), Types.NUMERIC);
                else ps.setNull(2, Types.NUMERIC);

                if (pl.getQuantity() != null) ps.setObject(3, pl.getQuantity(), Types.NUMERIC);
                else ps.setNull(3, Types.NUMERIC);

                ps.setLong(4, lineNo++);

                if (pl.getNameId() != null) ps.setObject(5, pl.getNameId(), Types.NUMERIC);
                else ps.setNull(5, Types.NUMERIC);

                if (pl.getValueAddedTaxId() != null) ps.setObject(6, pl.getValueAddedTaxId(), Types.NUMERIC);
                else ps.setNull(6, Types.NUMERIC);

                if (pl.getUnitOfMeasureId() != null) ps.setObject(7, pl.getUnitOfMeasureId(), Types.NUMERIC);
                else ps.setNull(7, Types.NUMERIC);

                ps.addBatch();
            }
            ps.executeBatch();
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

package hr.agape.document.repository;

import hr.agape.document.ref.domain.PreparedLine;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.List;

@ApplicationScoped
public class DocumentLineRepository {

    private final DataSource dataSource;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public DocumentLineRepository(@io.quarkus.agroal.DataSource("oracle") DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public void insert(long headerId, List<PreparedLine> lines) throws SQLException {
        final String sql =
                "INSERT INTO SD_STAVKE " +
                        " (ID, SD_GLAVA_ID, ARTIKL_ID, KOLICINA, STAVKABR, NAZIV_ID, PDV_ID, JMJ_ID) " +
                        " VALUES (SD_STAVKE_SEQ.NEXTVAL, ?, ?, ?, ?, ?, ?, ?)";

        try (Connection c = dataSource.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, headerId);
            for (PreparedLine pl : lines) {
                ps.setObject(2, pl.getItemId(), Types.INTEGER);
                ps.setObject(3, pl.getQuantity(), Types.NUMERIC);
                ps.setObject(4, pl.getLineNumber(), Types.INTEGER);
                ps.setObject(5, pl.getNameId(), Types.INTEGER);
                ps.setObject(6, pl.getUnitOfMeasureId(), Types.INTEGER);
                ps.setObject(7, pl.getValueAddedTaxId(), Types.INTEGER);
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    public int nextLineNumber(long headerId) throws SQLException {
        final String sql = "SELECT NVL(MAX(STAVKABR), 0) + 1 FROM SD_STAVKE WHERE SD_GLAVA_ID = ?";
        try (Connection c = dataSource.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, headerId);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getInt(1);
            }
        }
    }
}

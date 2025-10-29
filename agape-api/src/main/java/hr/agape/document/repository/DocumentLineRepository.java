package hr.agape.document.repository;

import hr.agape.document.dto.DocumentItemLineDTO;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
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

    public void insert(Long headerId, List<DocumentItemLineDTO> lines) throws SQLException {
        final String sql = """
                INSERT INTO SD_STAVKE
                  (ID,
                   SD_GLAVA_ID,
                   ARTIKL_ID,
                   KOLICINA,
                   STAVKABR,
                   NAZIV_ID,
                   PDV_ID,
                   JMJ_ID)
                VALUES
                  (SD_STAVKE_SEQ.NEXTVAL,
                   ?, ?, ?, NULL, ?, ?, ?)
                """;

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            for (DocumentItemLineDTO pl : lines) {
                ps.setLong(1, headerId);

                if (pl.getItemId() != null) {
                    ps.setObject(2, pl.getItemId(), Types.NUMERIC);
                } else {
                    ps.setNull(2, Types.NUMERIC);
                }

                if (pl.getQuantity() != null) {
                    ps.setObject(3, pl.getQuantity(), Types.NUMERIC);
                } else {
                    ps.setNull(3, Types.NUMERIC);
                }

                if (pl.getNameId() != null) {
                    ps.setObject(4, pl.getNameId(), Types.NUMERIC);
                } else {
                    ps.setNull(4, Types.NUMERIC);
                }

                if (pl.getValueAddedTaxId() != null) {
                    ps.setObject(5, pl.getValueAddedTaxId(), Types.NUMERIC);
                } else {
                    ps.setNull(5, Types.NUMERIC);
                }

                if (pl.getUnitOfMeasureId() != null) {
                    ps.setObject(6, pl.getUnitOfMeasureId(), Types.NUMERIC);
                } else {
                    ps.setNull(6, Types.NUMERIC);
                }

                ps.addBatch();
            }

            ps.executeBatch();
        }
    }

    public void deleteByHeader(Long headerId) throws SQLException {
        final String sql = "DELETE FROM SD_STAVKE WHERE SD_GLAVA_ID = ?";

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            ps.setLong(1, headerId);
            ps.executeUpdate();
        }
    }
}

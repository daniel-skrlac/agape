package hr.agape.document.repository;

import hr.agape.document.domain.DocumentLine;
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
    public DocumentLineRepository(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public void insert(long headerId, List<DocumentLine> lines) throws SQLException {
        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(
                     "INSERT INTO SD_STAVKE " +
                             "(SD_GLAVA_ID, ARTIKL_ID, KOLICINA, STAVKABR, NAZIV_ID, PDV_ID, JMJ_ID) " +
                             "VALUES (?, ?, ?, NULL, NULL, NULL, NULL)"
             )) {

            ps.setLong(1, headerId);
            for (DocumentLine line : lines) {
                ps.setObject(2, line.getItemId(), Types.INTEGER);
                ps.setObject(3, line.getQuantity(), Types.NUMERIC);
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }
}

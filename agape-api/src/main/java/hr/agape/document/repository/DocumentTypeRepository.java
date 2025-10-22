package hr.agape.document.repository;

import hr.agape.document.domain.DocumentType;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;

@ApplicationScoped
public class DocumentTypeRepository {

    private final DataSource dataSource;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public DocumentTypeRepository(@io.quarkus.agroal.DataSource("oracle") DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public Optional<DocumentType> findTypeForDocumentId(int documentId) throws SQLException {
        String sql = """
                  SELECT z.SD_SIFREZ_ID, z.SKL_SIFREZ_ID, z.DOKUMENTID, z.NAZIVDOKUMENTA,
                         z.ULAZIZLAZ, z.MIJENJAZALIHU
                  FROM SD_SIFREG r
                  JOIN SD_SIFREZ z ON z.SD_SIFREZ_ID = r.SD_SIFREZ_ID
                  WHERE r.DOKUMENT_ID = ?
                """;
        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, documentId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return Optional.empty();
                return Optional.of(DocumentType.builder()
                        .id(rs.getInt("SD_SIFREZ_ID"))
                        .storeTypeGroupId(rs.getInt("SKL_SIFREZ_ID"))
                        .documentCode(rs.getString("DOKUMENTID"))
                        .displayName(rs.getString("NAZIVDOKUMENTA"))
                        .inOutFlag(rs.getInt("ULAZIZLAZ"))
                        .changesStock(rs.getInt("MIJENJAZALIHU"))
                        .build());
            }
        }
    }

}

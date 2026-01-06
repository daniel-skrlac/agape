package hr.agape.document.warehouse.repository;

import hr.agape.document.warehouse.dto.WarehouseDTO;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

//SKLADISTE
@ApplicationScoped
public class WarehouseRepository {

    private final DataSource dataSource;

    @Inject
    public WarehouseRepository(@io.quarkus.agroal.DataSource("oracle") DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public long countWarehousesForDocument(int documentId) throws SQLException {
        final String sql = """
                SELECT COUNT(*) AS CNT
                FROM (
                    SELECT DISTINCT r.SKLADISTE_ID
                    FROM SD_SIFREG r
                    WHERE r.DOKUMENT_ID = ?
                )
                """;
        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, documentId);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getLong("CNT");
            }
        }
    }

    public List<WarehouseDTO> pageWarehousesForDocument(int documentId, int offset, int limit) throws SQLException {
        final String sql = """
                WITH distinct_wh AS (
                    SELECT DISTINCT r.SKLADISTE_ID
                    FROM SD_SIFREG r
                    WHERE r.DOKUMENT_ID = ?
                ),
                ranked_wh AS (
                    SELECT
                        dw.SKLADISTE_ID,
                        ROW_NUMBER() OVER (ORDER BY dw.SKLADISTE_ID) AS rn
                    FROM distinct_wh dw
                )
                SELECT SKLADISTE_ID AS WID
                FROM ranked_wh
                WHERE rn BETWEEN ? AND ?
                ORDER BY SKLADISTE_ID
                """;

        int start = offset + 1;
        int end = offset + limit;

        List<WarehouseDTO> out = new ArrayList<>(limit);
        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, documentId);
            ps.setInt(2, start);
            ps.setInt(3, end);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    int wid = rs.getInt("WID");
                    out.add(WarehouseDTO.builder()
                            .warehouseId(wid)
                            .name("Skladiste " + wid)
                            .build());
                }
            }
        }
        return out;
    }

    public List<Long> listWarehouses() throws SQLException {
        String sql = """
                    SELECT DISTINCT g.SKLADISTE_ID
                    FROM SKL_ARTIKLIG g
                    WHERE NVL(g.AKTIVANARTIKL,1) = 1
                    ORDER BY g.SKLADISTE_ID
                """;

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            List<Long> out = new ArrayList<>();
            while (rs.next()) {
                out.add(rs.getLong(1));
            }
            return out;
        }
    }
}

package hr.agape.partner.repository;

import hr.agape.partner.domain.PartnerEntity;
import hr.agape.partner.dto.PartnerSearchFilter;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import oracle.jdbc.OraclePreparedStatement;
import oracle.jdbc.OracleTypes;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.List;

//PARTNERI
@ApplicationScoped
public class PartnerRepository {

    private final DataSource dataSource;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public PartnerRepository(@io.quarkus.agroal.DataSource("oracle") DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public boolean isMissingOrInactive(Long partnerId) throws SQLException {
        final String sql = """
                SELECT 1
                  FROM PARTNERI
                 WHERE PARTNER_ID = ?
                   AND NVL(AKTIVAN, 1) = 1
                """;
        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, partnerId);
            try (ResultSet rs = ps.executeQuery()) {
                return !rs.next();
            }
        }
    }

    public PartnerEntity findById(Long id) throws SQLException {
        final String sql = """
                    SELECT
                      p.PARTNER_ID,
                      p.KORISNIK_ID,
                      p.STATUSID,
                      p.PARTNERID,
                      p.OIB,
                      p.NAZIV,
                      p.ADRESA,
                      p.PTTBROJ,
                      p.PTTMJESTO,
                      NVL(p.AKTIVAN,1) AS AKTIVAN,
                      p.DATUM_IZRADE,
                      p.DATUM_IZMJENE
                    FROM PARTNERI p
                    WHERE p.PARTNER_ID = ?
                """;

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                return mapRowToEntity(rs);
            }
        }
    }

    public PartnerEntity insert(PartnerEntity in) throws SQLException {
        final String sql = """
                    INSERT INTO PARTNERI
                      (PARTNER_ID,
                       KORISNIK_ID,
                       STATUSID,
                       PARTNERID,
                       OIB,
                       NAZIV,
                       ADRESA,
                       PTTBROJ,
                       PTTMJESTO,
                       AKTIVAN,
                       DATUM_IZRADE)
                    VALUES
                      (PARTNERI_SEQ.NEXTVAL, ?, ?, ?, ?, ?, ?, ?, ?, ?, SYSDATE)
                    RETURNING PARTNER_ID INTO ?
                """;

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            OraclePreparedStatement ops = ps.unwrap(OraclePreparedStatement.class);

            if (in.getTenantId() != null) ops.setLong(1, in.getTenantId());
            else ops.setNull(1, Types.NUMERIC);
            if (in.getStatusId() != null) ops.setInt(2, in.getStatusId());
            else ops.setNull(2, Types.NUMERIC);
            if (in.getPartnerNumber() != null) ops.setInt(3, in.getPartnerNumber());
            else ops.setNull(3, Types.NUMERIC);
            if (in.getTaxNumber() != null) ops.setString(4, in.getTaxNumber());
            else ops.setNull(4, Types.VARCHAR);
            if (in.getName() != null) ops.setString(5, in.getName());
            else ops.setNull(5, Types.VARCHAR);
            if (in.getAddress() != null) ops.setString(6, in.getAddress());
            else ops.setNull(6, Types.VARCHAR);
            if (in.getPostalCode() != null) ops.setString(7, in.getPostalCode());
            else ops.setNull(7, Types.VARCHAR);
            if (in.getCity() != null) ops.setString(8, in.getCity());
            else ops.setNull(8, Types.VARCHAR);
            if (in.getActive() != null) ops.setInt(9, in.getActive() ? 1 : 0);
            else ops.setNull(9, Types.NUMERIC);

            ops.registerReturnParameter(10, OracleTypes.NUMBER); // PARTNER_ID
            ops.executeUpdate();

            long newId;
            try (ResultSet rs = ops.getReturnResultSet()) {
                rs.next();
                newId = rs.getLong(1);
            }
            return findById(newId);
        }
    }

    public PartnerEntity update(Long id, PartnerEntity patch) throws SQLException {
        final String sql = """
                    UPDATE PARTNERI SET
                      STATUSID   = COALESCE(?, STATUSID),
                      PARTNERID  = COALESCE(?, PARTNERID),
                      OIB        = COALESCE(?, OIB),
                      NAZIV      = COALESCE(?, NAZIV),
                      ADRESA     = COALESCE(?, ADRESA),
                      PTTBROJ    = COALESCE(?, PTTBROJ),
                      PTTMJESTO  = COALESCE(?, PTTMJESTO),
                      AKTIVAN    = COALESCE(?, AKTIVAN),
                      DATUM_IZMJENE = SYSDATE
                    WHERE PARTNER_ID = ?
                """;

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            if (patch.getStatusId() != null) ps.setInt(1, patch.getStatusId());
            else ps.setNull(1, Types.NUMERIC);
            if (patch.getPartnerNumber() != null) ps.setInt(2, patch.getPartnerNumber());
            else ps.setNull(2, Types.NUMERIC);
            if (patch.getTaxNumber() != null) ps.setString(3, patch.getTaxNumber());
            else ps.setNull(3, Types.VARCHAR);
            if (patch.getName() != null) ps.setString(4, patch.getName());
            else ps.setNull(4, Types.VARCHAR);
            if (patch.getAddress() != null) ps.setString(5, patch.getAddress());
            else ps.setNull(5, Types.VARCHAR);
            if (patch.getPostalCode() != null) ps.setString(6, patch.getPostalCode());
            else ps.setNull(6, Types.VARCHAR);
            if (patch.getCity() != null) ps.setString(7, patch.getCity());
            else ps.setNull(7, Types.VARCHAR);
            if (patch.getActive() != null) ps.setInt(8, patch.getActive() ? 1 : 0);
            else ps.setNull(8, Types.NUMERIC);
            ps.setLong(9, id);

            int updated = ps.executeUpdate();
            if (updated == 0) return null;
            return findById(id);
        }
    }

    public long countFiltered(PartnerSearchFilter f) throws SQLException {
        StringBuilder sql = new StringBuilder("""
                    SELECT COUNT(*) AS CNT
                      FROM PARTNERI p
                     WHERE 1=1
                """);

        List<Object> params = new ArrayList<>();
        addWhereClauses(f, sql, params);

        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(sql.toString())) {
            bindParams(ps, params);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getLong("CNT");
            }
        }
    }

    public List<PartnerEntity> pageFiltered(PartnerSearchFilter f) throws SQLException {
        int page = Math.max(0, f.getPage());
        int size = Math.max(1, f.getSize());
        int start = page * size + 1;
        int end = page * size + size;

        StringBuilder inner = new StringBuilder("""
                    SELECT
                      p.PARTNER_ID,
                      p.KORISNIK_ID,
                      p.STATUSID,
                      p.PARTNERID,
                      p.OIB,
                      p.NAZIV,
                      p.ADRESA,
                      p.PTTBROJ,
                      p.PTTMJESTO,
                      NVL(p.AKTIVAN,1) AS AKTIVAN,
                      p.DATUM_IZRADE,
                      p.DATUM_IZMJENE
                    FROM PARTNERI p
                    WHERE 1=1
                """);

        List<Object> params = new ArrayList<>();
        addWhereClauses(f, inner, params);

        inner.append(" ORDER BY p.NAZIV ASC NULLS LAST, p.PARTNER_ID DESC ");

        String pagedSql = """
                    SELECT * FROM (
                      SELECT inner_q.*, ROWNUM rn
                        FROM (
                """ + inner + """
                        ) inner_q
                       WHERE ROWNUM <= ?
                    )
                    WHERE rn >= ?
                """;

        List<PartnerEntity> out = new ArrayList<>(size);
        try (Connection c = dataSource.getConnection();
             PreparedStatement ps = c.prepareStatement(pagedSql)) {

            int idx = bindParams(ps, params);
            ps.setInt(idx++, end);
            ps.setInt(idx, start);

            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(mapRowToEntity(rs));
                }
            }
        }
        return out;
    }

    private static void addWhereClauses(PartnerSearchFilter f, StringBuilder sql, List<Object> params) {
        if (f.getTenantId() != null) {
            sql.append(" AND p.KORISNIK_ID = ? ");
            params.add(f.getTenantId());
        }
        if (f.getStatusId() != null) {
            sql.append(" AND p.STATUSID = ? ");
            params.add(f.getStatusId());
        }
        if (Boolean.TRUE.equals(f.getActiveOnly())) {
            sql.append(" AND NVL(p.AKTIVAN,1) = 1 ");
        }
        if (f.getTaxNumber() != null && !f.getTaxNumber().isBlank()) {
            sql.append(" AND p.OIB = ? ");
            params.add(f.getTaxNumber());
        }
        if (f.getNameContains() != null && !f.getNameContains().isBlank()) {
            sql.append(" AND LOWER(p.NAZIV) LIKE ? ");
            params.add("%" + f.getNameContains().toLowerCase() + "%");
        }
    }

    private static int bindParams(PreparedStatement ps, List<Object> params) throws SQLException {
        int i = 1;
        for (Object val : params) {
            switch (val) {
                case Long v -> ps.setLong(i++, v);
                case Integer v -> ps.setInt(i++, v);
                case String v -> ps.setString(i++, v);
                case null, default -> ps.setObject(i++, val);
            }
        }
        return i;
    }

    private static PartnerEntity mapRowToEntity(ResultSet rs) throws SQLException {
        Date cAt = rs.getDate("DATUM_IZRADE");
        Date uAt = rs.getDate("DATUM_IZMJENE");

        int aktivan = rs.getInt("AKTIVAN");
        boolean aktivanWasNull = rs.wasNull();

        Long id = rs.getLong("PARTNER_ID");
        if (rs.wasNull()) id = null;

        Long tenantId = rs.getLong("KORISNIK_ID");
        if (rs.wasNull()) tenantId = null;

        Integer statusId = rs.getInt("STATUSID");
        if (rs.wasNull()) statusId = null;

        Integer partnerNumber = rs.getInt("PARTNERID");
        if (rs.wasNull()) partnerNumber = null;

        return PartnerEntity.builder()
                .id(id)
                .tenantId(tenantId)
                .statusId(statusId)
                .partnerNumber(partnerNumber)
                .taxNumber(rs.getString("OIB"))
                .name(rs.getString("NAZIV"))
                .address(rs.getString("ADRESA"))
                .postalCode(rs.getString("PTTBROJ"))
                .city(rs.getString("PTTMJESTO"))
                .active(aktivanWasNull ? Boolean.TRUE : aktivan == 1)
                .createdAt(cAt != null ? cAt.toLocalDate() : null)
                .updatedAt(uAt != null ? uAt.toLocalDate() : null)
                .build();
    }
}

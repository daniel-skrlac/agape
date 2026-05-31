package hr.agape.common.database;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import oracle.jdbc.OraclePreparedStatement;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class Jdbc {

    @Inject
    @io.quarkus.agroal.DataSource("oracle")
    DataSource dataSource;

    @FunctionalInterface
    public interface StatementBinder {
        void bind(PreparedStatement ps) throws SQLException;
    }

    @FunctionalInterface
    public interface RowMapper<T> {
        T map(ResultSet rs) throws SQLException;
    }

    @FunctionalInterface
    public interface ReturnExtractor<T> {
        T extract(ResultSet returnRs) throws SQLException;
    }

    @FunctionalInterface
    public interface SqlFunction<T, R> {
        R apply(T t) throws SQLException;
    }

    @FunctionalInterface
    public interface SqlConsumer<T> {
        void accept(T t) throws SQLException;
    }

    public <T> T withConnection(SqlFunction<Connection, T> fn) throws SQLException {
        try (Connection c = dataSource.getConnection()) {
            return fn.apply(c);
        }
    }

    public void withConnectionVoid(SqlConsumer<Connection> fn) throws SQLException {
        try (Connection c = dataSource.getConnection()) {
            fn.accept(c);
        }
    }

    public int update(String sql, StatementBinder binder) throws SQLException {
        return withConnection(c -> update(c, sql, binder));
    }

    public int update(Connection c, String sql, StatementBinder binder) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            if (binder != null) {
                binder.bind(ps);
            }
            return ps.executeUpdate();
        }
    }

    public <T> List<T> query(String sql, StatementBinder binder, RowMapper<T> mapper) throws SQLException {
        return withConnection(c -> query(c, sql, binder, mapper));
    }

    public <T> List<T> query(Connection c, String sql, StatementBinder binder, RowMapper<T> mapper)
            throws SQLException {
        if (mapper == null) {
            throw new SQLException("Row mapper must not be null.");
        }

        try (PreparedStatement ps = c.prepareStatement(sql)) {
            if (binder != null) {
                binder.bind(ps);
            }

            try (ResultSet rs = ps.executeQuery()) {
                List<T> out = new ArrayList<>();

                while (rs.next()) {
                    out.add(mapper.map(rs));
                }

                return out;
            }
        }
    }

    public <T> T queryOne(String sql, StatementBinder binder, RowMapper<T> mapper) throws SQLException {
        return withConnection(c -> queryOne(c, sql, binder, mapper));
    }

    public <T> T queryOne(Connection c, String sql, StatementBinder binder, RowMapper<T> mapper)
            throws SQLException {
        List<T> list = query(c, sql, binder, mapper);
        return list.isEmpty() ? null : list.get(0);
    }

    public <T> T updateReturning(
            Connection c,
            String sql,
            StatementBinder binder,
            ReturnExtractor<T> returnExtractor
    ) throws SQLException {
        if (returnExtractor == null) {
            throw new SQLException("Return extractor must not be null.");
        }

        try (PreparedStatement ps = c.prepareStatement(sql)) {
            OraclePreparedStatement ops = ps.unwrap(OraclePreparedStatement.class);

            if (binder != null) {
                binder.bind(ops);
            }

            ops.executeUpdate();

            try (ResultSet rs = ops.getReturnResultSet()) {
                if (rs == null || !rs.next()) {
                    return null;
                }

                return returnExtractor.extract(rs);
            }
        }
    }

    public static void setLong(PreparedStatement ps, int idx, Long v) throws SQLException {
        if (v != null) {
            ps.setLong(idx, v);
        } else {
            ps.setNull(idx, Types.NUMERIC);
        }
    }

    public static void setString(PreparedStatement ps, int idx, String v) throws SQLException {
        if (v != null) {
            ps.setString(idx, v);
        } else {
            ps.setNull(idx, Types.VARCHAR);
        }
    }

    public static void setClobString(PreparedStatement ps, int idx, String v) throws SQLException {
        if (v != null) {
            ps.setString(idx, v);
        } else {
            ps.setNull(idx, Types.CLOB);
        }
    }

    public static void setLocalDate(PreparedStatement ps, int idx, LocalDate v) throws SQLException {
        if (v != null) {
            ps.setDate(idx, Date.valueOf(v));
        } else {
            ps.setNull(idx, Types.DATE);
        }
    }
}

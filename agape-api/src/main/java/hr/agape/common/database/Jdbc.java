package hr.agape.common.database;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import oracle.jdbc.OraclePreparedStatement;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.function.BiConsumer;

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

    public <T> T withConnection(Connection c, SqlFunction<Connection, T> fn) throws SQLException {
        return fn.apply(c);
    }

    public void withConnectionVoid(Connection c, SqlConsumer<Connection> fn) throws SQLException {
        fn.accept(c);
    }

    public int update(String sql, StatementBinder binder) throws SQLException {
        return withConnection(c -> update(c, sql, binder));
    }

    public int update(Connection c, String sql, StatementBinder binder) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            if (binder != null) binder.bind(ps);
            return ps.executeUpdate();
        }
    }

    public <T> int[] batchUpdate(
            String sql,
            Collection<T> items,
            BiConsumer<PreparedStatement, T> binder
    ) throws SQLException {
        return withConnection(c -> batchUpdate(c, sql, items, binder, 1000));
    }

    public <T> int[] batchUpdate(
            Connection c,
            String sql,
            Collection<T> items,
            BiConsumer<PreparedStatement, T> binder,
            int batchSize
    ) throws SQLException {
        if (items == null || items.isEmpty()) return new int[0];

        try (PreparedStatement ps = c.prepareStatement(sql)) {
            int i = 0;

            for (T item : items) {
                binder.accept(ps, item);
                ps.addBatch();

                i++;
                if (i % batchSize == 0) {
                    ps.executeBatch();
                }
            }

            return ps.executeBatch();
        }
    }

    public <T> List<T> query(String sql, StatementBinder binder, RowMapper<T> mapper) throws SQLException {
        return withConnection(c -> query(c, sql, binder, mapper));
    }

    public <T> List<T> query(Connection c, String sql, StatementBinder binder, RowMapper<T> mapper) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            if (binder != null) binder.bind(ps);
            try (ResultSet rs = ps.executeQuery()) {
                List<T> out = new ArrayList<>();
                while (rs.next()) out.add(mapper.map(rs));
                return out;
            }
        }
    }

    /**
     * Runs work under an Oracle DBMS_LOCK exclusive lock.
     * Lock is NOT released on commit (release_on_commit = FALSE), so it survives internal procedure commits.
     */
    public void withExclusiveLock(String lockName, int timeoutSeconds, SqlWork work) throws SQLException {
        withConnectionVoid(c -> {
            boolean prevAutoCommit = c.getAutoCommit();
            c.setAutoCommit(true);

            String lockHandle = null;
            try {
                lockHandle = allocateUnique(c, lockName);
                requestExclusive(c, lockHandle, timeoutSeconds);

                work.run(c);

            } finally {
                if (lockHandle != null) {
                    try {
                        release(c, lockHandle);
                    } catch (SQLException ignored) {
                    }
                }
                c.setAutoCommit(prevAutoCommit);
            }
        });
    }

    private static String allocateUnique(Connection c, String lockName) throws SQLException {
        try (CallableStatement cs = c.prepareCall("{ call SYS.DBMS_LOCK.ALLOCATE_UNIQUE(?, ?) }")) {
            cs.setString(1, lockName);
            cs.registerOutParameter(2, Types.VARCHAR);
            cs.execute();
            return cs.getString(2);
        }
    }

    private static void requestExclusive(Connection c, String lockHandle, int timeoutSeconds) throws SQLException {
        try (CallableStatement cs = c.prepareCall(
                "BEGIN ? := SYS.DBMS_LOCK.REQUEST(?, ?, ?, FALSE); END;")) {

            cs.registerOutParameter(1, Types.INTEGER);
            cs.setString(2, lockHandle);
            cs.setInt(3, 6);
            cs.setInt(4, timeoutSeconds);

            cs.execute();

            int rc = cs.getInt(1);
            if (rc != 0) {
                throw new SQLException("Could not acquire DB lock '" + lockHandle + "' rc=" + rc
                        + " (0=success, 1=timeout, 2=deadlock, 3=param, 4=already_own, 5=illegal_handle)");
            }
        }
    }


    private static void release(Connection c, String lockHandle) throws SQLException {
        try (CallableStatement cs = c.prepareCall("{ ? = call SYS.DBMS_LOCK.RELEASE(?) }")) {
            cs.registerOutParameter(1, Types.INTEGER);
            cs.setString(2, lockHandle);
            cs.execute();
        }
    }

    @FunctionalInterface
    public interface SqlWork {
        void run(Connection c) throws SQLException;
    }

    public <T> T queryOne(String sql, StatementBinder binder, RowMapper<T> mapper) throws SQLException {
        List<T> list = query(sql, binder, mapper);
        return list.isEmpty() ? null : list.get(0);
    }

    public <T> T updateReturning(
            String sql,
            StatementBinder binder,
            ReturnExtractor<T> returnExtractor
    ) throws SQLException {
        return withConnection(c -> updateReturning(c, sql, binder, returnExtractor));
    }

    public <T> T updateReturning(
            Connection c,
            String sql,
            StatementBinder binder,
            ReturnExtractor<T> returnExtractor
    ) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            OraclePreparedStatement ops = ps.unwrap(OraclePreparedStatement.class);
            if (binder != null) binder.bind(ops);

            ops.executeUpdate();

            try (ResultSet rs = ops.getReturnResultSet()) {
                if (rs == null || !rs.next()) return null;
                return returnExtractor.extract(rs);
            }
        }
    }

    public static void setLong(PreparedStatement ps, int idx, Long v) throws SQLException {
        if (v != null) ps.setLong(idx, v);
        else ps.setNull(idx, Types.NUMERIC);
    }

    public static void setInt(PreparedStatement ps, int idx, Integer v) throws SQLException {
        if (v != null) ps.setInt(idx, v);
        else ps.setNull(idx, Types.INTEGER);
    }

    public static void setBigDecimal(PreparedStatement ps, int idx, BigDecimal v) throws SQLException {
        if (v != null) ps.setBigDecimal(idx, v);
        else ps.setNull(idx, Types.NUMERIC);
    }

    public static void setString(PreparedStatement ps, int idx, String v) throws SQLException {
        if (v != null) ps.setString(idx, v);
        else ps.setNull(idx, Types.VARCHAR);
    }

    public static void setClobString(PreparedStatement ps, int idx, String v) throws SQLException {
        if (v != null) ps.setString(idx, v);
        else ps.setNull(idx, Types.CLOB);
    }

    public static void setLocalDate(PreparedStatement ps, int idx, LocalDate v) throws SQLException {
        if (v != null) ps.setDate(idx, Date.valueOf(v));
        else ps.setNull(idx, Types.DATE);
    }

    @FunctionalInterface
    public interface SqlFunction<T, R> {
        R apply(T t) throws SQLException;
    }

    @FunctionalInterface
    public interface SqlConsumer<T> {
        void accept(T t) throws SQLException;
    }
}

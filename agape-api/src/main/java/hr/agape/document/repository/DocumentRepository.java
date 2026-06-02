package hr.agape.document.repository;

import hr.agape.common.database.Jdbc;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;

@ApplicationScoped
public class DocumentRepository {

    private final Jdbc jdbc;

    @Inject
    public DocumentRepository(Jdbc jdbc) {
        this.jdbc = jdbc;
    }

    public void initLegacyContext(Connection c, Long dokumentId, String operatorOibDigits) throws SQLException {
        if (dokumentId == null) {
            throw new SQLException("Cannot initialize legacy context: DOKUMENT_ID is null.");
        }

        final String plsql = """
                BEGIN
                  KNJIZI_MK.CITAJ_GLOBALNO(?);
                  GLO.DOKUMENT_ID := ?;
                  GLO.OPERATER(?);
                END;
                """;

        try (CallableStatement cs = c.prepareCall(plsql)) {
            cs.setLong(1, dokumentId);
            cs.setLong(2, dokumentId);
            bindOib(cs, 3, operatorOibDigits);
            cs.execute();
        }
    }

    public void bookDocument(
            Long sdGlavaId,
            Long documentId,
            String operatorOibDigits,
            String actorOibDigits,
            int knjizitiNaSkladiste,
            int knjizitiUkPopisa,
            int knjizitiNormative,
            int generirajZapisnik,
            int azurirajProdajne,
            int azurirajNabavne
    ) throws SQLException {
        jdbc.withConnectionVoid(c -> {
            boolean previousAutoCommit = c.getAutoCommit();
            c.setAutoCommit(false);

            try {
                bookDocument(
                        c,
                        sdGlavaId,
                        documentId,
                        operatorOibDigits,
                        actorOibDigits,
                        knjizitiNaSkladiste,
                        knjizitiUkPopisa,
                        knjizitiNormative,
                        generirajZapisnik,
                        azurirajProdajne,
                        azurirajNabavne
                );
                c.commit();
            } catch (SQLException e) {
                rollbackQuietly(c);
                throw e;
            } finally {
                restoreAutoCommitQuietly(c, previousAutoCommit);
            }
        });
    }

    public void bookDocument(
            Connection c,
            Long sdGlavaId,
            Long documentId,
            String operatorOibDigits,
            String actorOibDigits,
            int knjizitiNaSkladiste,
            int knjizitiUkPopisa,
            int knjizitiNormative,
            int generirajZapisnik,
            int azurirajProdajne,
            int azurirajNabavne
    ) throws SQLException {
        if (sdGlavaId == null) {
            throw new SQLException("Cannot book document: SD_GLAVA.ID is null.");
        }

        if (documentId == null) {
            throw new SQLException("Cannot book document: DOKUMENT_ID is null. SD_GLAVA.ID=" + sdGlavaId);
        }

        String bookingOib = firstNonBlank(actorOibDigits, operatorOibDigits);
        if (bookingOib == null || bookingOib.isBlank()) {
            throw new SQLException("Cannot book document: missing booking/operator OIB. SD_GLAVA.ID=" + sdGlavaId);
        }

        lockDraftHeader(c, sdGlavaId);
        initLegacyContext(c, documentId, bookingOib);

        try (CallableStatement cs = c.prepareCall("{ call KNJIZI_MK.KNJIZI_MK_DOKUMENT(?,?,?,?,?,?,?,?) }")) {
            cs.setLong(1, sdGlavaId);
            bindOib(cs, 2, bookingOib);
            cs.setInt(3, knjizitiNaSkladiste);
            cs.setInt(4, knjizitiUkPopisa);
            cs.setInt(5, knjizitiNormative);
            cs.setInt(6, generirajZapisnik);
            cs.setInt(7, azurirajProdajne);
            cs.setInt(8, azurirajNabavne);
            cs.execute();
        }

        assertDocumentBooked(c, sdGlavaId);
    }

    public void cancelDocument(
            Long headerId,
            String actorOibDigits,
            int stornoNaSkladiste,
            int stornoUkPopisa,
            int stornoVeznid,
            int postaviOznaku
    ) throws SQLException {
        jdbc.withConnectionVoid(c -> {
            boolean previousAutoCommit = c.getAutoCommit();
            c.setAutoCommit(false);

            try {
                cancelDocument(c, headerId, actorOibDigits, stornoNaSkladiste, stornoUkPopisa, stornoVeznid, postaviOznaku);
                c.commit();
            } catch (SQLException e) {
                rollbackQuietly(c);
                throw e;
            } finally {
                restoreAutoCommitQuietly(c, previousAutoCommit);
            }
        });
    }

    public void cancelDocument(
            Connection c,
            Long headerId,
            String actorOibDigits,
            int stornoNaSkladiste,
            int stornoUkPopisa,
            int stornoVeznid,
            int postaviOznaku
    ) throws SQLException {
        if (headerId == null) {
            throw new SQLException("Cannot cancel document: SD_GLAVA.ID is null.");
        }

        if (actorOibDigits == null || actorOibDigits.isBlank()) {
            throw new SQLException("Cannot cancel document: missing operator OIB. SD_GLAVA.ID=" + headerId);
        }

        Long documentId = lockPostedHeader(c, headerId);
        initLegacyContext(c, documentId, actorOibDigits);

        try (CallableStatement cs = c.prepareCall("{ call STORNO_MK.STORNO_MK_DOKUMENT(?,?,?,?,?) }")) {
            cs.setLong(1, headerId);
            cs.setInt(2, stornoNaSkladiste);
            cs.setInt(3, stornoUkPopisa);
            cs.setInt(4, stornoVeznid);
            cs.setInt(5, postaviOznaku);
            cs.execute();
        }

        assertDocumentCancelled(c, headerId);
    }

    private void lockDraftHeader(Connection c, Long sdGlavaId) throws SQLException {
        final String sql = """
                SELECT NVL(KNJIZENO, 0) AS KNJIZENO,
                       STORNIRAO
                  FROM SD_GLAVA
                 WHERE ID = ?
                 FOR UPDATE NOWAIT
                """;

        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, sdGlavaId);

            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new SQLException("Cannot book: SD_GLAVA not found. ID=" + sdGlavaId);
                }

                if (rs.getInt("KNJIZENO") == 1) {
                    throw new SQLException("Cannot book: document is already booked. SD_GLAVA.ID=" + sdGlavaId);
                }

                if (rs.getObject("STORNIRAO") != null) {
                    throw new SQLException("Cannot book: document is already cancelled/storno. SD_GLAVA.ID=" + sdGlavaId);
                }
            }
        }
    }

    private Long lockPostedHeader(Connection c, Long sdGlavaId) throws SQLException {
        final String sql = """
                SELECT NVL(KNJIZENO, 0) AS KNJIZENO,
                       STORNIRAO,
                       DOKUMENT_ID
                  FROM SD_GLAVA
                 WHERE ID = ?
                 FOR UPDATE NOWAIT
                """;

        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, sdGlavaId);

            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new SQLException("Cannot cancel: SD_GLAVA not found. ID=" + sdGlavaId);
                }

                if (rs.getInt("KNJIZENO") != 1) {
                    throw new SQLException("Cannot cancel: document is not booked. SD_GLAVA.ID=" + sdGlavaId);
                }

                if (rs.getObject("STORNIRAO") != null) {
                    throw new SQLException("Cannot cancel: document is already cancelled/storno. SD_GLAVA.ID=" + sdGlavaId);
                }

                Long documentId = rs.getLong("DOKUMENT_ID");
                if (rs.wasNull()) {
                    throw new SQLException("Cannot cancel: DOKUMENT_ID is null. SD_GLAVA.ID=" + sdGlavaId);
                }
                return documentId;
            }
        }
    }

    private void assertDocumentBooked(Connection c, Long sdGlavaId) throws SQLException {
        final String sql = """
                SELECT NVL(KNJIZENO, 0) AS KNJIZENO,
                       KNJIZIO,
                       DATUM_KNJIZENJA
                  FROM SD_GLAVA
                 WHERE ID = ?
                """;

        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, sdGlavaId);

            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new SQLException("Legacy booking failed: SD_GLAVA row disappeared. ID=" + sdGlavaId);
                }

                int posted = rs.getInt("KNJIZENO");
                if (posted != 1) {
                    throw new SQLException(
                            "Legacy booking procedure finished, but SD_GLAVA.KNJIZENO was not set to 1. "
                                    + "SD_GLAVA.ID=" + sdGlavaId
                                    + latestLegacyLogMessage(c, sdGlavaId)
                    );
                }

                Object knjizio = rs.getObject("KNJIZIO");
                Object datumKnjizenja = rs.getObject("DATUM_KNJIZENJA");

                if (knjizio == null || datumKnjizenja == null) {
                    throw new SQLException(
                            "Legacy booking procedure set KNJIZENO=1, but KNJIZIO or DATUM_KNJIZENJA is null. "
                                    + "SD_GLAVA.ID=" + sdGlavaId
                                    + latestLegacyLogMessage(c, sdGlavaId)
                    );
                }
            }
        }
    }

    private void assertDocumentCancelled(Connection c, Long sdGlavaId) throws SQLException {
        final String sql = """
                SELECT NVL(KNJIZENO, 0) AS KNJIZENO,
                       NVL(STORNO, 0) AS STORNO,
                       STORNIRAO,
                       DATUM_STORNO
                  FROM SD_GLAVA
                 WHERE ID = ?
                """;

        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, sdGlavaId);

            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new SQLException("Legacy storno failed: SD_GLAVA row disappeared. ID=" + sdGlavaId);
                }

                int posted = rs.getInt("KNJIZENO");
                int cancelled = rs.getInt("STORNO");
                Object cancelledBy = rs.getObject("STORNIRAO");
                Object cancelledAt = rs.getObject("DATUM_STORNO");

                if (posted != 0 || cancelled != 1 || cancelledBy == null || cancelledAt == null) {
                    throw new SQLException(
                            "Legacy storno procedure finished, but SD_GLAVA was not marked as cancelled. "
                                    + "Expected KNJIZENO=0, STORNO=1, STORNIRAO and DATUM_STORNO. "
                                    + "SD_GLAVA.ID=" + sdGlavaId
                                    + latestLegacyLogMessage(c, sdGlavaId)
                    );
                }
            }
        }
    }

    private String latestLegacyLogMessage(Connection c, Long sdGlavaId) {
        final String sql = """
                SELECT *
                  FROM (
                        SELECT TO_CHAR(DATUM, 'YYYY-MM-DD HH24:MI:SS') AS DATUM_TXT,
                               PCKG_NAME,
                               PROC_NAME,
                               PORUKA,
                               GRESKA
                          FROM KNJIZI_LOG
                         WHERE ID_DOKUMENTA = ?
                         ORDER BY DATUM DESC, ID DESC
                       )
                 WHERE ROWNUM = 1
                """;

        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, sdGlavaId);

            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return "";
                }

                return " Latest KNJIZI_LOG: [datum="
                        + rs.getString("DATUM_TXT")
                        + ", package="
                        + rs.getString("PCKG_NAME")
                        + ", procedure="
                        + rs.getString("PROC_NAME")
                        + ", greska="
                        + rs.getString("GRESKA")
                        + ", poruka="
                        + rs.getString("PORUKA")
                        + "]";
            }
        } catch (SQLException ignored) {
            return "";
        }
    }

    private static void bindOib(CallableStatement cs, int index, String oibDigits) throws SQLException {
        if (oibDigits == null || oibDigits.isBlank()) {
            cs.setNull(index, Types.NUMERIC);
            return;
        }

        String digits = oibDigits.replaceAll("[^0-9]", "");
        if (digits.isBlank()) {
            cs.setNull(index, Types.NUMERIC);
            return;
        }

        try {
            cs.setLong(index, Long.parseLong(digits));
        } catch (NumberFormatException e) {
            cs.setString(index, digits);
        }
    }

    private static String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        return second;
    }

    private static void rollbackQuietly(Connection c) {
        try {
            c.rollback();
        } catch (SQLException ignored) {
        }
    }

    private static void restoreAutoCommitQuietly(Connection c, boolean previousAutoCommit) {
        try {
            c.setAutoCommit(previousAutoCommit);
        } catch (SQLException ignored) {
        }
    }
}

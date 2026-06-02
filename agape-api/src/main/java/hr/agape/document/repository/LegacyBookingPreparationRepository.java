package hr.agape.document.repository;

import jakarta.enterprise.context.ApplicationScoped;

import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.SQLException;

@ApplicationScoped
public class LegacyBookingPreparationRepository {

    /**
     * Prepares SD_STAVKE and SD_GLAVA before KNJIZI_MK.KNJIZI_MK_DOKUMENT.
     *
     * <p>The legacy client captured a SKLADISTE snapshot before posting. Repair
     * missing snapshot fields for drafts created by older API versions, then
     * delegate calculations and header aggregation to the Oracle packages on
     * the same JDBC connection.</p>
     */
    public void prepareDraftForBooking(Connection c, Long headerId) throws SQLException {
        if (headerId == null) {
            throw new SQLException("Cannot prepare legacy booking: SD_GLAVA.ID is null.");
        }

        final String plsql = """
                DECLARE
                  p_header_id SD_GLAVA.ID%TYPE := ?;

                  v_sdg SD_GLAVA%ROWTYPE;
                  v_sta SD_STAVKE%ROWTYPE;
                  v_sar SKLADISTE%ROWTYPE;

                  v_documentid SD_SIFREZ.DOKUMENTID%TYPE;
                  v_ulazizlaz SD_SIFREZ.ULAZIZLAZ%TYPE;
                  v_tip_prod SD_SIFREZ.TIPPRODAJNIHCIJENA%TYPE;
                  v_count NUMBER;
                  v_bad_lines NUMBER;
                  v_cijena_za NUMBER;
                BEGIN
                  SELECT *
                    INTO v_sdg
                    FROM SD_GLAVA
                   WHERE ID = p_header_id
                     AND NVL(KNJIZENO, 0) = 0
                     AND STORNIRAO IS NULL
                   FOR UPDATE;

                  IF GLO.KORISNIK_ID IS NULL THEN
                    KNJIZI_MK.CITAJ_GLOBALNO(v_sdg.DOKUMENT_ID);
                  END IF;

                  GLO.DOKUMENT_ID := v_sdg.DOKUMENT_ID;

                  SELECT z.DOKUMENTID,
                         z.ULAZIZLAZ,
                         z.TIPPRODAJNIHCIJENA
                    INTO v_documentid,
                         v_ulazizlaz,
                         v_tip_prod
                    FROM SD_SIFREG r
                    JOIN SD_SIFREZ z
                      ON z.SD_SIFREZ_ID = r.SD_SIFREZ_ID
                   WHERE r.DOKUMENT_ID = v_sdg.DOKUMENT_ID;

                  FOR line_rec IN (
                    SELECT ID
                      FROM SD_STAVKE
                     WHERE SD_GLAVA_ID = p_header_id
                     ORDER BY STAVKABR, ID
                     FOR UPDATE
                  ) LOOP
                    SELECT *
                      INTO v_sta
                      FROM SD_STAVKE
                     WHERE ID = line_rec.ID
                     FOR UPDATE;

                    SELECT *
                      INTO v_sar
                      FROM SKLADISTE s
                     WHERE s.ID = v_sta.ARTIKL_ID
                       AND s.CJENIK_ID = 1;

                    v_cijena_za := NVL(NULLIF(v_sar.CIJENAZA, 0), 1);

                    v_sta.NAZIV_ID := NVL(v_sta.NAZIV_ID, v_sar.NAZIV_ID);
                    v_sta.PDV_ID := NVL(v_sta.PDV_ID, v_sar.PDV_ID);
                    v_sta.JMJ_ID := NVL(v_sta.JMJ_ID, v_sar.JMJ_ID);

                    v_sta.ROBA := NVL(v_sta.ROBA, NVL(v_sar.ROBA, 0));
                    v_sta.USLUGA := NVL(v_sta.USLUGA, NVL(v_sar.USLUGA, 0));
                    v_sta.MAKROARTIKL := NVL(v_sta.MAKROARTIKL, NVL(v_sar.MAKROARTIKL, 0));
                    v_sta.JAMSTVODOBAVLJAC := NVL(v_sta.JAMSTVODOBAVLJAC, v_sar.JAMSTVODOBAVLJAC);
                    v_sta.JAMSTVOKUPAC := NVL(v_sta.JAMSTVOKUPAC, v_sar.JAMSTVOKUPAC);

                    -- The old OTPREMNICA screen kept a line-local stock value.
                    -- New lines start at zero; do not replace the snapshot with
                    -- the current warehouse balance during a later post.
                    v_sta.ZALIHATRENUTNA := NVL(v_sta.ZALIHATRENUTNA, 0);
                    v_sta.KOLICINAUPAKOVANJU := NVL(NULLIF(v_sta.KOLICINAUPAKOVANJU, 0),
                                                   NVL(NULLIF(v_sar.KOLICINAUPAKOVANJU, 0), 1));

                    v_sta.BRUTO := NVL(v_sta.BRUTO, v_sar.BRUTO);
                    v_sta.NETO := NVL(v_sta.NETO, v_sar.NETO);
                    v_sta.JMJBRUTONETO := NVL(v_sta.JMJBRUTONETO, v_sar.JMJBRUTONETO);
                    v_sta.CIJENAJEDINICE := NVL(v_sta.CIJENAJEDINICE, v_sar.CIJENAJEDINICE);

                    -- Preserve the warehouse snapshot captured when the draft
                    -- was created. POPUNI_CIJENE_NORMATIVA is intentionally not
                    -- used here: it belongs to normative-generated lines and
                    -- rewrites ordinary dispatch prices.
                    v_sta.CIJENAFAK := NVL(v_sta.CIJENAFAK, ROUND(NVL(v_sar.CIJENAFAK, 0), 2));
                    v_sta.CIJENAFAK1 := NVL(v_sta.CIJENAFAK1, NVL(v_sar.CIJENAFAK1, 0));
                    v_sta.CIJENANAB := NVL(v_sta.CIJENANAB, NVL(v_sar.CIJENANAB, 0));
                    v_sta.CIJENANAB_ := NVL(v_sta.CIJENANAB_, NVL(v_sar.CIJENANAB_, NVL(v_sar.CIJENANAB, 0)));
                    v_sta.CIJENAZA := NVL(NULLIF(v_sta.CIJENAZA, 0), v_cijena_za);
                    v_sta.CIJENABP := NVL(v_sta.CIJENABP, ROUND(NVL(v_sar.CIJENABP, 0), 2));
                    v_sta.CIJENASP := NVL(v_sta.CIJENASP, ROUND(NVL(v_sar.CIJENASP, 0), 2));
                    v_sta.CIJENAPN := NVL(v_sta.CIJENAPN, ROUND(NVL(v_sar.CIJENAPN, 0), 2));
                    v_sta.CIJENAMP := NVL(v_sta.CIJENAMP, ROUND(NVL(v_sar.CIJENAMP, 0), 2));
                    v_sta.CIJENAKP := NVL(v_sta.CIJENAKP, ROUND(NVL(v_sar.CIJENAKP, 0), 2));
                    v_sta.KOLICINA := NVL(v_sta.KOLICINA, 0);

                    KNJIZI_MK.RACUNAJ_STA(
                      p_header_id,
                      v_sta,
                      v_tip_prod,
                      v_cijena_za
                    );

                    IF v_ulazizlaz = GLO.Izlaz THEN
                      KNJIZI_MK.RACUNAJ_RABAT_STA_I(p_header_id, v_sta);
                    ELSIF v_ulazizlaz = GLO.Ulaz THEN
                      KNJIZI_MK.RACUNAJ_RABAT_STA_U(p_header_id, v_sta);
                    END IF;

                    v_sta.IZNOSFAK := ROUND(NVL(v_sta.IZNOSFAK, 0), 2);
                    v_sta.IZNOSFAK1 := 0;
                    v_sta.IZNOSNAB := ROUND(NVL(v_sta.IZNOSNAB, 0), 2);
                    v_sta.IZNOSRABATA := ROUND(NVL(v_sta.IZNOSRABATA, 0), 2);
                    v_sta.IZNOSMARZE := 0;
                    v_sta.MARZASTOPA := 0;
                    v_sta.IZNOSBP := ROUND(NVL(v_sta.IZNOSBP, 0), 2);
                    v_sta.IZNOSPDV := ROUND(NVL(v_sta.IZNOSPDV, 0), 2);
                    v_sta.IZNOSTRO := ROUND(NVL(v_sta.IZNOSTRO, 0), 2);
                    v_sta.IZNOSSP := ROUND(NVL(v_sta.IZNOSSP, 0), 2);
                    v_sta.IZNOSPN := ROUND(NVL(v_sta.IZNOSPN, 0), 2);
                    v_sta.IZNOSMP := ROUND(NVL(v_sta.IZNOSMP, 0), 2);
                    v_sta.IZNOSKP := ROUND(NVL(v_sta.IZNOSKP, 0), 2);

                    IF NVL(v_sta.USLUGA, 0) > 0 THEN
                      v_sta.CIJENAKP := 0;
                      v_sta.IZNOSKP := 0;
                    END IF;

                    v_sta.IZNOSKK := NVL(v_sta.IZNOSKK, 0);
                    v_sta.IZNOSZT := NVL(v_sta.IZNOSZT, 0);
                    v_sta.SIFRAVALUTE := NVL(v_sta.SIFRAVALUTE, '   ');
                    v_sta.VALUTA := NVL(v_sta.VALUTA, '   ');
                    v_sta.BROJJEDINICAV := NVL(v_sta.BROJJEDINICAV, 1);
                    v_sta.TECAJ := NVL(v_sta.TECAJ, 0);
                    v_sta.CIJENAFAK_V := NVL(v_sta.CIJENAFAK_V, 0);
                    v_sta.IZNOSFAK_V := NVL(v_sta.IZNOSFAK_V, 0);
                    v_sta.KNJIZENO := NVL(v_sta.KNJIZENO, 0);
                    v_sta.STORNO := NVL(v_sta.STORNO, 0);
                    v_sta.PLACENO := NVL(v_sta.PLACENO, 0);
                    v_sta.IZMJENJENACIJENA := NVL(v_sta.IZMJENJENACIJENA, 0);
                    v_sta.IZRADIO := NVL(v_sta.IZRADIO, GLO.OIB_OPERATERA);
                    v_sta.IZMIJENIO := NVL(v_sta.IZMIJENIO, 0);
                    v_sta.NAPLATIO := NVL(v_sta.NAPLATIO, 0);
                    v_sta.TAGFLAG := NVL(v_sta.TAGFLAG, 0);

                    UPDATE SD_STAVKE
                       SET ROW = v_sta
                     WHERE ID = v_sta.ID;
                  END LOOP;

                  SELECT COUNT(*)
                    INTO v_count
                    FROM SD_STAVKE
                   WHERE SD_GLAVA_ID = p_header_id;

                  IF v_count = 0 THEN
                    RAISE_APPLICATION_ERROR(-20003, 'Legacy preparation requires at least one line. Header ID=' || p_header_id);
                  END IF;

                  UPDATE SD_GLAVA
                     SET BROJSTAVAKA = v_count,
                         SIFRATEKSTA = NVL(SIFRATEKSTA, v_documentid),
                         BROJJEDINICAV = NVL(BROJJEDINICAV, 1),
                         RABATSTOPA = NVL(RABATSTOPA, 0)
                   WHERE ID = p_header_id;

                  SELECT *
                    INTO v_sdg
                    FROM SD_GLAVA
                   WHERE ID = p_header_id
                   FOR UPDATE;

                  ZBROJI_DOKUMENTE.ZBROJI_STA_SDG(p_header_id, v_sdg);

                  SELECT COUNT(*)
                    INTO v_bad_lines
                    FROM SD_STAVKE
                   WHERE SD_GLAVA_ID = p_header_id
                     AND (
                       CIJENAFAK IS NULL
                       OR CIJENAFAK1 IS NULL
                       OR CIJENANAB IS NULL
                       OR CIJENANAB_ IS NULL
                       OR CIJENAZA IS NULL
                       OR CIJENABP IS NULL
                       OR CIJENASP IS NULL
                       OR CIJENAMP IS NULL
                       OR CIJENAKP IS NULL
                       OR IZNOSFAK IS NULL
                       OR IZNOSFAK1 IS NULL
                       OR IZNOSNAB IS NULL
                       OR IZNOSBP IS NULL
                       OR IZNOSPDV IS NULL
                       OR IZNOSSP IS NULL
                       OR IZNOSMP IS NULL
                       OR IZNOSKP IS NULL
                     );

                  IF v_bad_lines > 0 THEN
                    RAISE_APPLICATION_ERROR(-20004, 'Legacy preparation left NULL calculated fields on SD_STAVKE. Header ID=' || p_header_id);
                  END IF;
                END;
                """;

        try (CallableStatement cs = c.prepareCall(plsql)) {
            cs.setLong(1, headerId);
            cs.execute();
        }
    }
}

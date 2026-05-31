package hr.agape.document.repository;

import jakarta.enterprise.context.ApplicationScoped;

import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.SQLException;

@ApplicationScoped
public class LegacyBookingPreparationRepository {

    /**
     * Prepares SD_STAVKE + SD_GLAVA before KNJIZI_MK.KNJIZI_MK_DOKUMENT.
     * <p>
     * This is a wrapper around old Oracle logic. It should not reimplement the booking engine.
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
                  v_pdv SIFREPDV%ROWTYPE;
                
                  v_documentid SD_SIFREZ.DOKUMENTID%TYPE;
                  v_ulazizlaz SD_SIFREZ.ULAZIZLAZ%TYPE;
                  v_tip_prod SD_SIFREZ.TIPPRODAJNIHCIJENA%TYPE;
                  v_tip_fak SD_SIFREZ.TIPFAKTURNECIJENE%TYPE;
                  v_tip_nab SD_SIFREZ.TIPNABAVNECIJENE%TYPE;
                
                  v_tip_cijena SKL_SIFREZ.TIPCIJENA%TYPE;
                
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
                         z.TIPPRODAJNIHCIJENA,
                         z.TIPFAKTURNECIJENE,
                         z.TIPNABAVNECIJENE,
                         ss.TIPCIJENA
                    INTO v_documentid,
                         v_ulazizlaz,
                         v_tip_prod,
                         v_tip_fak,
                         v_tip_nab,
                         v_tip_cijena
                    FROM SD_SIFREG r
                    JOIN SD_SIFREZ z
                      ON z.SD_SIFREZ_ID = r.SD_SIFREZ_ID
                    JOIN SKL_SIFREG sr
                      ON sr.SKLADISTE_ID = r.SKLADISTE_ID
                    JOIN SKL_SIFREZ ss
                      ON ss.SKL_SIFREZ_ID = sr.SKL_SIFREZ_ID
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
                
                    IF NVL(v_sar.CIJENAZA, 0) = 0 THEN
                      v_cijena_za := 1;
                    ELSE
                      v_cijena_za := v_sar.CIJENAZA;
                    END IF;
                
                    v_sta.NAZIV_ID := NVL(v_sta.NAZIV_ID, v_sar.NAZIV_ID);
                    v_sta.PDV_ID := NVL(v_sta.PDV_ID, v_sar.PDV_ID);
                    v_sta.JMJ_ID := NVL(v_sta.JMJ_ID, v_sar.JMJ_ID);
                
                    SELECT *
                      INTO v_pdv
                      FROM SIFREPDV
                     WHERE PDV_ID = v_sta.PDV_ID;
                
                    v_sta.ROBA := NVL(v_sta.ROBA, v_sar.ROBA);
                    v_sta.USLUGA := NVL(v_sta.USLUGA, v_sar.USLUGA);
                    v_sta.MAKROARTIKL := NVL(v_sta.MAKROARTIKL, v_sar.MAKROARTIKL);
                    v_sta.JAMSTVODOBAVLJAC := NVL(v_sta.JAMSTVODOBAVLJAC, v_sar.JAMSTVODOBAVLJAC);
                    v_sta.JAMSTVOKUPAC := NVL(v_sta.JAMSTVOKUPAC, v_sar.JAMSTVOKUPAC);
                    v_sta.ZALIHATRENUTNA := v_sar.ZALIHATRENUTNA;
                
                    IF NVL(v_sta.KOLICINAUPAKOVANJU, 0) = 0 THEN
                      v_sta.KOLICINAUPAKOVANJU := NVL(v_sar.KOLICINAUPAKOVANJU, 1);
                    END IF;
                
                    IF NVL(v_sta.KOLICINAUPAKOVANJU, 0) = 0 THEN
                      v_sta.KOLICINAUPAKOVANJU := 1;
                    END IF;
                
                    v_sta.BRUTO := v_sar.BRUTO;
                    v_sta.NETO := v_sar.NETO;
                    v_sta.JMJBRUTONETO := v_sar.JMJBRUTONETO;
                    v_sta.CIJENAJEDINICE := v_sar.CIJENAJEDINICE;
                    v_sta.CIJENAZA := v_cijena_za;
                
                    v_sta.CIJENAFAK := NVL(v_sta.CIJENAFAK, NVL(v_sar.CIJENAFAK, 0));
                    v_sta.RABATSTOPA := NVL(v_sta.RABATSTOPA, NVL(v_sar.RABATSTOPA, 0));
                    v_sta.CIJENAFAK1 := 0;
                    v_sta.CIJENANAB := NVL(v_sta.CIJENANAB, NVL(v_sar.CIJENANAB, 0));
                    v_sta.MARZASTOPA := NVL(v_sta.MARZASTOPA, NVL(v_sar.MARZASTOPA, 0));
                    v_sta.CIJENANAB_ := NVL(v_sta.CIJENANAB_, NVL(v_sar.CIJENANAB_, 0));
                    v_sta.CIJENABP := NVL(v_sta.CIJENABP, NVL(v_sar.CIJENABP, 0));
                    v_sta.CIJENASP := NVL(v_sta.CIJENASP, NVL(v_sar.CIJENASP, 0));
                    v_sta.CIJENAPN := NVL(v_sta.CIJENAPN, NVL(v_sar.CIJENAPN, 0));
                    v_sta.CIJENAMP := NVL(v_sta.CIJENAMP, NVL(v_sar.CIJENAMP, 0));
                    v_sta.CIJENAKP := NVL(v_sta.CIJENAKP, NVL(v_sar.CIJENAKP, 0));
                
                    v_sta.KOLICINA := NVL(v_sta.KOLICINA, 0);
                
                    KNJIZI_MK.POPUNI_CIJENE_NORMATIVA(
                      p_header_id,
                      v_sta,
                      v_tip_fak,
                      v_tip_nab,
                      v_tip_prod
                    );
                
                    v_sta.CIJENAFAK := NVL(v_sta.CIJENAFAK, 0);
                    v_sta.CIJENAFAK1 := 0;
                    v_sta.CIJENANAB := NVL(v_sta.CIJENANAB, 0);
                    v_sta.CIJENANAB_ := NVL(v_sta.CIJENANAB_, 0);
                    v_sta.CIJENABP := NVL(v_sta.CIJENABP, 0);
                    v_sta.CIJENASP := NVL(v_sta.CIJENASP, 0);
                    v_sta.CIJENAPN := NVL(v_sta.CIJENAPN, 0);
                    v_sta.CIJENAMP := NVL(v_sta.CIJENAMP, 0);
                    v_sta.CIJENAKP := NVL(v_sta.CIJENAKP, 0);
                
                    KNJIZI_MK.RACUNAJ_STA(
                      p_header_id,
                      v_sta,
                      v_tip_prod,
                      v_cijena_za
                    );
                
                    IF v_ulazizlaz = GLO.Izlaz THEN
                      v_sta.CIJENANAB_ := NVL(v_sar.CIJENANAB_, 0);
                      v_sta.IZNOSNAB := v_sta.CIJENANAB_ * v_sta.KOLICINA / v_cijena_za;
                
                      IF v_tip_cijena = GLO.Nabavna THEN
                        IF v_sta.KOLICINA = 0 THEN
                          RAISE_APPLICATION_ERROR(-20001, 'KOLICINA is zero for SD_STAVKE.ID=' || v_sta.ID);
                        END IF;
                
                        v_sta.CIJENAFAK := v_sta.CIJENANAB_;
                        v_sta.IZNOSFAK := v_sta.CIJENAFAK * v_sta.KOLICINA / v_cijena_za;
                
                        v_sta.CIJENABP := v_sta.CIJENANAB_;
                        v_sta.IZNOSBP := v_sta.CIJENABP * v_sta.KOLICINA / v_cijena_za;
                
                        v_sta.IZNOSPDV := v_sta.IZNOSBP * (NVL(v_pdv.STOPAPDV, 0) / 100);
                        v_sta.IZNOSTRO := v_sta.IZNOSBP * (NVL(v_pdv.STOPATRO, 0) / 100);
                        v_sta.IZNOSSP := v_sta.IZNOSBP + v_sta.IZNOSPDV + v_sta.IZNOSTRO;
                
                        v_sta.CIJENASP := ROUND(v_sta.IZNOSSP / (v_sta.KOLICINA / v_cijena_za), 2);
                        v_sta.IZNOSPN := v_sta.CIJENAPN * v_sta.KOLICINAUPAKOVANJU * (v_sta.KOLICINA / v_cijena_za);
                        v_sta.CIJENAMP := v_sta.CIJENASP + v_sta.CIJENAPN * v_sta.KOLICINAUPAKOVANJU;
                        v_sta.IZNOSMP := v_sta.IZNOSSP + v_sta.IZNOSPN;
                      ELSE
                        IF NVL(v_sta.CIJENANAB, 0) > NVL(v_sta.CIJENAFAK, 0) THEN
                          v_sta.CIJENANAB := v_sta.CIJENAFAK;
                          v_sta.CIJENANAB_ := v_sta.CIJENAFAK;
                          v_sta.IZNOSNAB := v_sta.CIJENANAB_ * (v_sta.KOLICINA / v_cijena_za);
                        END IF;
                      END IF;
                
                      KNJIZI_MK.RACUNAJ_MARZU_STA(p_header_id, v_sta);
                      KNJIZI_MK.RACUNAJ_RABAT_STA_I(p_header_id, v_sta);
                
                      v_sta.IZNOSPN := v_sta.CIJENAPN * v_sta.KOLICINAUPAKOVANJU * (v_sta.KOLICINA / v_cijena_za);
                      v_sta.IZNOSMP := v_sta.IZNOSSP + v_sta.IZNOSPN;
                    END IF;
                
                    IF NVL(v_sta.USLUGA, 0) > 0 THEN
                      v_sta.CIJENAKP := 0;
                      v_sta.IZNOSKP := 0;
                    END IF;
                
                    v_sta.IZNOSFAK := NVL(v_sta.IZNOSFAK, 0);
                    v_sta.IZNOSRABATA := NVL(v_sta.IZNOSRABATA, 0);
                    v_sta.CIJENAFAK1 := 0;
                    v_sta.IZNOSFAK1 := 0;
                    v_sta.IZNOSKK := NVL(v_sta.IZNOSKK, 0);
                    v_sta.IZNOSZT := NVL(v_sta.IZNOSZT, 0);
                    v_sta.IZNOSNAB := NVL(v_sta.IZNOSNAB, 0);
                    v_sta.IZNOSMARZE := NVL(v_sta.IZNOSMARZE, 0);
                    v_sta.IZNOSBP := NVL(v_sta.IZNOSBP, 0);
                    v_sta.IZNOSPDV := NVL(v_sta.IZNOSPDV, 0);
                    v_sta.IZNOSTRO := NVL(v_sta.IZNOSTRO, 0);
                    v_sta.IZNOSSP := NVL(v_sta.IZNOSSP, 0);
                    v_sta.IZNOSPN := NVL(v_sta.IZNOSPN, 0);
                    v_sta.IZNOSMP := NVL(v_sta.IZNOSMP, 0);
                    v_sta.IZNOSKP := NVL(v_sta.IZNOSKP, 0);
                
                    UPDATE SD_STAVKE
                       SET ROW = v_sta
                     WHERE ID = v_sta.ID;
                  END LOOP;
                
                  SELECT COUNT(*)
                    INTO v_count
                    FROM SD_STAVKE
                   WHERE SD_GLAVA_ID = p_header_id;
                
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
                
                  UPDATE SD_GLAVA
                     SET IZNOSFAK1 = 0,
                         BROJJEDINICAV = NVL(BROJJEDINICAV, 1),
                         RABATSTOPA = NVL(RABATSTOPA, 0)
                   WHERE ID = p_header_id;
                
                  SELECT COUNT(*)
                    INTO v_bad_lines
                    FROM SD_STAVKE
                   WHERE SD_GLAVA_ID = p_header_id
                     AND (
                       CIJENAFAK IS NULL
                       OR CIJENABP IS NULL
                       OR CIJENASP IS NULL
                       OR CIJENAMP IS NULL
                       OR CIJENAKP IS NULL
                       OR IZNOSFAK IS NULL
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

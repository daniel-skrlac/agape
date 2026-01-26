/* =====================================================================
   AGAPE_API
   - Robust recalc wrapper around legacy KNJIZI_MK + ZBROJI_DOKUMENTE
   - Fixes common ORA-01403 (no data found) and “silent context” problems
   - IMPORTANT: do NOT swallow context init errors (that is how NULLs happen)
   ===================================================================== */

CREATE OR REPLACE PACKAGE AGAPE_API AS
  PROCEDURE RECALC_SD_GLAVA(p_sd_glava_id IN NUMBER);
  PROCEDURE RECALC_SD_GLAVA_TMP(p_sd_glava_id IN NUMBER);

  /* Optional: explicit context version (useful from Java if you already know ctx) */
  PROCEDURE RECALC_SD_GLAVA_CTX(
    p_sd_glava_id IN NUMBER,
    p_dokument_id IN NUMBER,
    p_operator_oib IN NUMBER
  );

  PROCEDURE RECALC_SD_GLAVA_TMP_CTX(
    p_sd_glava_id IN NUMBER,
    p_dokument_id IN NUMBER,
    p_operator_oib IN NUMBER
  );
END AGAPE_API;
/
SHOW ERRORS PACKAGE AGAPE_API
/

CREATE OR REPLACE PACKAGE BODY AGAPE_API AS

  /* -----------------------------
     Helpers
     ----------------------------- */

  FUNCTION normalize_oib(p_any IN VARCHAR2) RETURN NUMBER IS
    l_digits VARCHAR2(64);
BEGIN
    -- take first continuous digit sequence (legacy IZRADIO sometimes stores text)
    l_digits := REGEXP_SUBSTR(p_any, '\d+');
    IF l_digits IS NULL THEN
      RETURN 0;
END IF;

    -- if it’s longer than NUMBER precision for OIB, still safe, take first 20
    l_digits := SUBSTR(l_digits, 1, 20);

RETURN TO_NUMBER(l_digits);
EXCEPTION
    WHEN OTHERS THEN
      RETURN 0;
END normalize_oib;

  PROCEDURE raise_ctx_error(p_where VARCHAR2, p_dokument_id NUMBER, p_oib NUMBER) IS
BEGIN
    RAISE_APPLICATION_ERROR(
      -20055,
      'AGAPE_API context init failed at '||p_where||
      ' DOKUMENT_ID='||NVL(TO_CHAR(p_dokument_id), 'NULL')||
      ' OIB='||NVL(TO_CHAR(p_oib), 'NULL')||CHR(10)||
      'SQLERRM='||SQLERRM||CHR(10)||
      DBMS_UTILITY.FORMAT_ERROR_STACK||CHR(10)||
      DBMS_UTILITY.FORMAT_ERROR_BACKTRACE
    );
END;

  PROCEDURE init_legacy_context(p_dokument_id IN NUMBER, p_oib IN NUMBER) IS
BEGIN
    -- If ANY of these fails, you want to know. Silent failures = NULLs later.
BEGIN
      KNJIZI_MK.CITAJ_GLOBALNO(p_dokument_id);
EXCEPTION WHEN OTHERS THEN
      raise_ctx_error('KNJIZI_MK.CITAJ_GLOBALNO', p_dokument_id, p_oib);
END;

BEGIN
      GLO.DOKUMENT_ID := p_dokument_id;
EXCEPTION WHEN OTHERS THEN
      raise_ctx_error('GLO.DOKUMENT_ID :=', p_dokument_id, p_oib);
END;

BEGIN
      -- legacy signature is usually GLO.OPERATER(<NUMBER>)
      GLO.OPERATER(p_oib);
EXCEPTION WHEN OTHERS THEN
      raise_ctx_error('GLO.OPERATER', p_dokument_id, p_oib);
END;
END init_legacy_context;

  PROCEDURE persist_header(p_id IN NUMBER, p_rec IN SD_GLAVA%ROWTYPE) IS
BEGIN
UPDATE SD_GLAVA
SET ROW = p_rec
WHERE ID = p_id;

IF SQL%ROWCOUNT = 0 THEN
      RAISE_APPLICATION_ERROR(-20001, 'SD_GLAVA row not found for ID=' || p_id);
END IF;
END persist_header;

  PROCEDURE calc_tmp(p_id IN NUMBER, p_oib IN NUMBER) IS
BEGIN
    -- legacy routine: fills TMP + updates SD_STAVKE
    KNJIZI_MK.GENERIRAJ_KARTICE_STA_TMP(p_id, p_oib);
EXCEPTION
    WHEN OTHERS THEN
      RAISE_APPLICATION_ERROR(
        -20050,
        'AGAPE_API: GENERIRAJ_KARTICE_STA_TMP failed for SD_GLAVA_ID='||p_id||
        ' OIB='||p_oib||CHR(10)||
        'SQLERRM='||SQLERRM||CHR(10)||
        DBMS_UTILITY.FORMAT_ERROR_STACK||CHR(10)||
        DBMS_UTILITY.FORMAT_ERROR_BACKTRACE
      );
END calc_tmp;

  PROCEDURE lock_and_load(p_sd_glava_id IN NUMBER, p_sdg OUT SD_GLAVA%ROWTYPE) IS
BEGIN
SELECT *
INTO p_sdg
FROM SD_GLAVA
WHERE ID = p_sd_glava_id
    FOR UPDATE;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20010, 'AGAPE_API: SD_GLAVA not found ID='||p_sd_glava_id);
WHEN OTHERS THEN
      RAISE_APPLICATION_ERROR(
        -20011,
        'AGAPE_API: failed to lock/load SD_GLAVA ID='||p_sd_glava_id||CHR(10)||
        'SQLERRM='||SQLERRM||CHR(10)||
        DBMS_UTILITY.FORMAT_ERROR_STACK||CHR(10)||
        DBMS_UTILITY.FORMAT_ERROR_BACKTRACE
      );
END lock_and_load;

  /* -----------------------------
     Public API
     ----------------------------- */

  PROCEDURE RECALC_SD_GLAVA(p_sd_glava_id IN NUMBER) IS
    l_sdg SD_GLAVA%ROWTYPE;
    l_oib NUMBER;
BEGIN
    DBMS_APPLICATION_INFO.SET_MODULE('AGAPE_API', 'RECALC_SD_GLAVA');

    lock_and_load(p_sd_glava_id, l_sdg);

    l_oib := normalize_oib(l_sdg.IZRADIO);

    IF l_sdg.DOKUMENT_ID IS NULL THEN
      RAISE_APPLICATION_ERROR(-20012, 'AGAPE_API: SD_GLAVA.DOKUMENT_ID is NULL for ID='||p_sd_glava_id);
END IF;

    init_legacy_context(l_sdg.DOKUMENT_ID, l_oib);

    calc_tmp(p_sd_glava_id, l_oib);

    -- “real document” sum
    ZBROJI_DOKUMENTE.ZBROJI_STA_SDG(p_sd_glava_id, l_sdg);

    persist_header(p_sd_glava_id, l_sdg);
END RECALC_SD_GLAVA;

  PROCEDURE RECALC_SD_GLAVA_TMP(p_sd_glava_id IN NUMBER) IS
    l_sdg SD_GLAVA%ROWTYPE;
    l_oib NUMBER;
BEGIN
    DBMS_APPLICATION_INFO.SET_MODULE('AGAPE_API', 'RECALC_SD_GLAVA_TMP');

    lock_and_load(p_sd_glava_id, l_sdg);

    l_oib := normalize_oib(l_sdg.IZRADIO);

    IF l_sdg.DOKUMENT_ID IS NULL THEN
      RAISE_APPLICATION_ERROR(-20012, 'AGAPE_API: SD_GLAVA.DOKUMENT_ID is NULL for ID='||p_sd_glava_id);
END IF;

    init_legacy_context(l_sdg.DOKUMENT_ID, l_oib);

    calc_tmp(p_sd_glava_id, l_oib);

    -- TMP mode sum
    ZBROJI_DOKUMENTE.ZBROJI_STA_TMP_SDG(p_sd_glava_id, l_sdg);

    persist_header(p_sd_glava_id, l_sdg);
END RECALC_SD_GLAVA_TMP;

  PROCEDURE RECALC_SD_GLAVA_CTX(
    p_sd_glava_id IN NUMBER,
    p_dokument_id IN NUMBER,
    p_operator_oib IN NUMBER
  ) IS
    l_sdg SD_GLAVA%ROWTYPE;
BEGIN
    DBMS_APPLICATION_INFO.SET_MODULE('AGAPE_API', 'RECALC_SD_GLAVA_CTX');

    lock_and_load(p_sd_glava_id, l_sdg);

    IF p_dokument_id IS NULL THEN
      RAISE_APPLICATION_ERROR(-20013, 'AGAPE_API: p_dokument_id is NULL');
END IF;

    init_legacy_context(p_dokument_id, NVL(p_operator_oib, 0));

    calc_tmp(p_sd_glava_id, NVL(p_operator_oib, 0));

    ZBROJI_DOKUMENTE.ZBROJI_STA_SDG(p_sd_glava_id, l_sdg);

    persist_header(p_sd_glava_id, l_sdg);
END RECALC_SD_GLAVA_CTX;

  PROCEDURE RECALC_SD_GLAVA_TMP_CTX(
    p_sd_glava_id IN NUMBER,
    p_dokument_id IN NUMBER,
    p_operator_oib IN NUMBER
  ) IS
    l_sdg SD_GLAVA%ROWTYPE;
BEGIN
    DBMS_APPLICATION_INFO.SET_MODULE('AGAPE_API', 'RECALC_SD_GLAVA_TMP_CTX');

    lock_and_load(p_sd_glava_id, l_sdg);

    IF p_dokument_id IS NULL THEN
      RAISE_APPLICATION_ERROR(-20013, 'AGAPE_API: p_dokument_id is NULL');
END IF;

    init_legacy_context(p_dokument_id, NVL(p_operator_oib, 0));

    calc_tmp(p_sd_glava_id, NVL(p_operator_oib, 0));

    ZBROJI_DOKUMENTE.ZBROJI_STA_TMP_SDG(p_sd_glava_id, l_sdg);

    persist_header(p_sd_glava_id, l_sdg);
END RECALC_SD_GLAVA_TMP_CTX;

END AGAPE_API;
/
SHOW ERRORS PACKAGE BODY AGAPE_API
/
EXIT
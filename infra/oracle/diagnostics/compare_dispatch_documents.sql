-- Compare one legacy dispatch document with one document created through agape-api.
--
-- Usage from the repository root:
-- docker compose --env-file infra/.env -f infra/docker-compose.db.yml exec -T oracle-xe \
--   sh -lc 'sqlplus -L -s "$APP_USER/$APP_USER_PASSWORD@//localhost:1521/XE" \
--   @/diagnostics/compare_dispatch_documents.sql OLD_SD_GLAVA_ID NEW_SD_GLAVA_ID'
--
-- The script is read-only. It intentionally compares persisted Oracle effects,
-- not only the API response.

set pagesize 500
set linesize 320
set trimspool on
set feedback on
set verify off
set serveroutput on

define old_header_id = '&1'
define new_header_id = '&2'

prompt === Comparable legacy configuration guard ===
select case
         when old_glava.dokument_id = new_glava.dokument_id
          and old_mapping.skladiste_id = new_mapping.skladiste_id then 'MATCH'
         else 'DIFFERENT CONFIGURATION - DO NOT TREAT AS A LIKE-FOR-LIKE COMPARISON'
       end as comparison_status,
       old_glava.dokument_id as legacy_dokument_id,
       new_glava.dokument_id as java_dokument_id,
       old_mapping.skladiste_id as legacy_skladiste_id,
       new_mapping.skladiste_id as java_skladiste_id
  from sd_glava old_glava
  cross join sd_glava new_glava
  join sd_sifreg old_mapping
    on old_mapping.dokument_id = old_glava.dokument_id
  join sd_sifreg new_mapping
    on new_mapping.dokument_id = new_glava.dokument_id
 where old_glava.id = &old_header_id
   and new_glava.id = &new_header_id;

prompt === SD_GLAVA headers ===
select case
         when g.id = &old_header_id then 'LEGACY'
         when g.id = &new_header_id then 'JAVA'
       end as source,
       g.id,
       g.dokument_id,
       g.dokumentbr,
       g.partner_id,
       to_char(g.datum_dokumenta, 'YYYY-MM-DD') as datum_dokumenta,
       g.brojstavaka,
       g.izradio,
       g.izmijenio,
       to_char(g.datum_izmjene, 'YYYY-MM-DD HH24:MI:SS') as datum_izmjene,
       g.knjizeno,
       g.knjizio,
       to_char(g.datum_knjizenja, 'YYYY-MM-DD HH24:MI:SS') as datum_knjizenja,
       g.storno,
       g.stornirao,
       to_char(g.datum_storno, 'YYYY-MM-DD HH24:MI:SS') as datum_storno,
       g.preporucenamarza,
       g.marzastopa,
       g.iznosfak,
       g.iznoszt,
       g.iznosnab,
       g.iznosbp,
       g.iznospdv,
       g.iznossp,
       g.iznosmp,
       g.iznoskp
  from sd_glava g
 where g.id in (&old_header_id, &new_header_id)
 order by source;

prompt === SD_GLAVA NULL-versus-zero defaults ===
select case
         when g.id = &old_header_id then 'LEGACY'
         when g.id = &new_header_id then 'JAVA'
       end as source,
       case
         when g.preporucenamarza is null then 'NULL'
         else to_char(g.preporucenamarza)
       end as preporucenamarza,
       case
         when g.iznoszt is null then 'NULL'
         else to_char(g.iznoszt)
       end as iznoszt,
       case
         when g.iznoskk is null then 'NULL'
         else to_char(g.iznoskk)
       end as iznoskk,
       case
         when g.iznosmarze is null then 'NULL'
         else to_char(g.iznosmarze)
       end as iznosmarze
  from sd_glava g
 where g.id in (&old_header_id, &new_header_id)
 order by source;

prompt === Warehouse and logical document mapping ===
select case
         when g.id = &old_header_id then 'LEGACY'
         when g.id = &new_header_id then 'JAVA'
       end as source,
       g.id as sd_glava_id,
       r.skladiste_id,
       r.dokument_id,
       r.sd_sifrez_id,
       z.dokumentid as document_code,
       z.nazivdokumenta as document_name,
       z.ulazizlaz,
       z.knjizitinaskladiste
  from sd_glava g
  join sd_sifreg r on r.dokument_id = g.dokument_id
  join sd_sifrez z on z.sd_sifrez_id = r.sd_sifrez_id
 where g.id in (&old_header_id, &new_header_id)
 order by source, r.skladiste_id, r.sd_sifrez_id;

prompt === SD_STAVKE summary ===
select case
         when s.sd_glava_id = &old_header_id then 'LEGACY'
         when s.sd_glava_id = &new_header_id then 'JAVA'
       end as source,
       s.sd_glava_id,
       count(*) as line_count,
       sum(s.kolicina) as quantity_sum,
       sum(s.iznosfak) as iznosfak_sum,
       sum(s.iznosnab) as iznosnab_sum,
       sum(s.iznosbp) as iznosbp_sum,
       sum(s.iznospdv) as iznospdv_sum,
       sum(s.iznossp) as iznossp_sum,
       sum(s.iznosmp) as iznosmp_sum,
       sum(s.iznoskp) as iznoskp_sum,
       sum(case
             when s.cijenafak is null
               or s.cijenafak1 is null
               or s.cijenanab is null
               or s.cijenanab_ is null
               or s.cijenaza is null
               or s.cijenabp is null
               or s.cijenasp is null
               or s.cijenamp is null
               or s.cijenakp is null
               or s.iznosfak is null
               or s.iznosnab is null
               or s.iznosbp is null
               or s.iznospdv is null
               or s.iznossp is null
               or s.iznosmp is null
               or s.iznoskp is null
             then 1
             else 0
           end) as incomplete_calculated_lines
  from sd_stavke s
 where s.sd_glava_id in (&old_header_id, &new_header_id)
 group by s.sd_glava_id
 order by source;

prompt === SD_STAVKE NULL-versus-zero profile ===
select case
         when s.sd_glava_id = &old_header_id then 'LEGACY'
         when s.sd_glava_id = &new_header_id then 'JAVA'
       end as source,
       count(*) as lines,
       sum(case when s.zalihatrenutna is null then 1 else 0 end) as zaliha_null,
       sum(case when s.zalihatrenutna = 0 then 1 else 0 end) as zaliha_zero,
       sum(case when trim(s.sifravalute) is null and s.sifravalute is not null then 1 else 0 end) as sifravalute_spaces,
       sum(case when trim(s.valuta) is null and s.valuta is not null then 1 else 0 end) as valuta_spaces,
       sum(case when s.brojjedinicav = 1 then 1 else 0 end) as brojjedinicav_one,
       sum(case when s.cijenanab_ is null then 1 else 0 end) as cijenanab_aux_null,
       sum(case when s.cijenaza is null then 1 else 0 end) as cijenaza_null,
       sum(case when s.iznosfak1 = 0 then 1 else 0 end) as iznosfak1_zero,
       sum(case when s.iznosmarze = 0 then 1 else 0 end) as iznosmarze_zero,
       sum(case when s.cijenakp = 0 then 1 else 0 end) as cijenakp_zero,
       sum(case when s.iznoskp = 0 then 1 else 0 end) as iznoskp_zero,
       sum(case when s.tecaj = 0 then 1 else 0 end) as tecaj_zero,
       sum(case when s.knjizeno = 0 then 1 else 0 end) as knjizeno_zero,
       sum(case when s.storno = 0 then 1 else 0 end) as storno_zero,
       sum(case when s.placeno = 0 then 1 else 0 end) as placeno_zero,
       sum(case when s.tagflag = 0 then 1 else 0 end) as tagflag_zero
  from sd_stavke s
 where s.sd_glava_id in (&old_header_id, &new_header_id)
 group by s.sd_glava_id
 order by source;

prompt === SD_STAVKE details ===
select case
         when s.sd_glava_id = &old_header_id then 'LEGACY'
         when s.sd_glava_id = &new_header_id then 'JAVA'
       end as source,
       s.sd_glava_id,
       s.stavkabr,
       s.artikl_id,
       s.kolicina,
       s.naziv_id,
       s.pdv_id,
       s.jmj_id,
       s.cijenafak,
       s.cijenafak1,
       s.cijenanab,
       s.cijenanab_,
       s.cijenaza,
       s.cijenabp,
       s.cijenasp,
       s.cijenamp,
       s.cijenakp,
       s.iznosfak,
       s.iznosnab,
       s.iznosbp,
       s.iznospdv,
       s.iznossp,
       s.iznosmp,
       s.iznoskp,
       s.izradio,
       s.izmijenio,
       to_char(s.datum_izmjene, 'YYYY-MM-DD HH24:MI:SS') as datum_izmjene,
       s.knjizeno,
       s.storno
  from sd_stavke s
 where s.sd_glava_id in (&old_header_id, &new_header_id)
 order by source, s.stavkabr, s.id;

prompt === SD_PDV tax aggregation rows ===
select case
         when p.sd_glava_id = &old_header_id then 'LEGACY'
         when p.sd_glava_id = &new_header_id then 'JAVA'
       end as source,
       p.*
  from sd_pdv p
 where p.sd_glava_id in (&old_header_id, &new_header_id)
 order by source;

prompt === SKLKARTICE inventory postings summary ===
select case
         when k.sd_glava_id = &old_header_id then 'LEGACY'
         when k.sd_glava_id = &new_header_id then 'JAVA'
       end as source,
       k.sd_glava_id,
       count(*) as card_count,
       sum(k.inpkolicina) as inp_quantity_sum,
       sum(k.outkolicina) as out_quantity_sum,
       sum(k.inpvrijednostnab) as inp_purchase_value_sum,
       sum(k.outvrijednostnab) as out_purchase_value_sum
  from sklkartice k
 where k.sd_glava_id in (&old_header_id, &new_header_id)
 group by k.sd_glava_id
 order by source;

prompt === SKLKARTICE inventory postings details ===
select case
         when k.sd_glava_id = &old_header_id then 'LEGACY'
         when k.sd_glava_id = &new_header_id then 'JAVA'
       end as source,
       k.sd_glava_id,
       k.stavkabr,
       k.artikl_id,
       k.dokument_id,
       k.dokumentbr,
       k.inpkolicina,
       k.outkolicina,
       k.inpvrijednostnab,
       k.outvrijednostnab,
       k.knjizeno,
       k.storno,
       k.knjizio,
       to_char(k.datum_knjizenja, 'YYYY-MM-DD HH24:MI:SS') as datum_knjizenja
  from sklkartice k
 where k.sd_glava_id in (&old_header_id, &new_header_id)
 order by source, k.stavkabr, k.id;

prompt === KNJIZI_LOG rows ===
select case
         when l.id_dokumenta = &old_header_id then 'LEGACY'
         when l.id_dokumenta = &new_header_id then 'JAVA'
       end as source,
       l.id_dokumenta,
       to_char(l.datum, 'YYYY-MM-DD HH24:MI:SS') as datum,
       l.pckg_name,
       l.proc_name,
       l.greska,
       l.poruka
  from knjizi_log l
 where l.id_dokumenta in (&old_header_id, &new_header_id)
 order by source, l.datum, l.id;

prompt === Direct SD_GLAVA_ID side-effect row counts ===
declare
  legacy_rows number;
  java_rows number;
begin
  for related_table in (
    select distinct table_name
      from user_tab_columns
     where column_name = 'SD_GLAVA_ID'
     order by table_name
  ) loop
    begin
      execute immediate
        'select sum(case when sd_glava_id = :legacy_id then 1 else 0 end), ' ||
        '       sum(case when sd_glava_id = :java_id then 1 else 0 end) ' ||
        '  from ' || related_table.table_name ||
        ' where sd_glava_id in (:legacy_filter_id, :java_filter_id)'
        into legacy_rows, java_rows
        using &old_header_id, &new_header_id, &old_header_id, &new_header_id;

      dbms_output.put_line(
        rpad(related_table.table_name, 32) ||
        ' legacy=' || nvl(to_char(legacy_rows), '0') ||
        ' java=' || nvl(to_char(java_rows), '0')
      );
    exception
      when others then
        dbms_output.put_line(
          rpad(related_table.table_name, 32) || ' ERROR=' || sqlerrm
        );
    end;
  end loop;
end;
/

prompt === End comparison ===

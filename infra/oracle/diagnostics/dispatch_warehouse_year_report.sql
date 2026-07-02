-- Report booked OTPREMNICA usage by legacy warehouse/year slot.
--
-- Usage from the repository root:
-- docker compose --env-file infra/.env -f infra/docker-compose.db.yml exec -T oracle-xe \
--   sh -lc 'sqlplus -L -s "$APP_USER/$APP_USER_PASSWORD@//localhost:1521/XE" \
--   @/diagnostics/dispatch_warehouse_year_report.sql'
--
-- The script is read-only. It shows which SKLADISTE_ID values were actually
-- used for booked dispatches and which document years they cover.

set pagesize 500
set linesize 260
set trimspool on
set feedback on
set verify off
set tab off

column skladiste_id format 999999 heading 'SKLADISTE_ID'
column document_year format a13 heading 'DOCUMENT_YEAR'
column posted_year format a11 heading 'POSTED_YEAR'
column first_document_date format a19 heading 'FIRST_DOCUMENT_DATE'
column last_document_date format a19 heading 'LAST_DOCUMENT_DATE'
column first_posted_at format a19 heading 'FIRST_POSTED_AT'
column last_posted_at format a19 heading 'LAST_POSTED_AT'
column booked_headers format 999999 heading 'BOOKED_HEADERS'
column line_count format 999999 heading 'LINE_COUNT'
column quantity_sum format 9999999990.999 heading 'QUANTITY_SUM'
column document_id_min format 999999999 heading 'DOCUMENT_ID_MIN'
column document_id_max format 999999999 heading 'DOCUMENT_ID_MAX'
column distinct_document_ids format 999999 heading 'DOC_ID_COUNT'
column document_id format 999999999 heading 'DOKUMENT_ID'
column sd_sifrez_id format 999999999 heading 'SD_SIFREZ_ID'
column document_code format a18 heading 'DOCUMENT_CODE'
column document_name format a32 heading 'DOCUMENT_NAME'
column ulazizlaz format 999999 heading 'ULAZIZLAZ'
column changes_stock format 999999 heading 'CHANGES_STOCK'
column created_headers format 999999 heading 'CREATED_HEADERS'
column draft_headers format 999999 heading 'DRAFT_HEADERS'
column cancelled_headers format 999999 heading 'CANCELLED_HEADERS'

prompt
prompt === OTPREMNICA mapping rows by SKLADISTE_ID ===
prompt

select r.skladiste_id,
       r.dokument_id,
       r.sd_sifrez_id,
       z.dokumentid as document_code,
       z.nazivdokumenta as document_name,
       z.ulazizlaz,
       z.mijenjazalihu as changes_stock
  from sd_sifreg r
  join sd_sifrez z
    on z.sd_sifrez_id = r.sd_sifrez_id
 where trim(upper(z.dokumentid)) = 'OTPREMNICA'
 order by r.skladiste_id, r.dokument_id, r.sd_sifrez_id;

prompt
prompt === Booked OTPREMNICA by SKLADISTE_ID and document date year ===
prompt Main confirmation view: if SKLADISTE_ID is used as a year/catalog partition, this table shows it.
prompt

with slot_mapping as (
    select r.skladiste_id,
           r.dokument_id,
           min(r.sd_sifrez_id) as sd_sifrez_id,
           min(z.dokumentid) as dokumentid,
           min(z.nazivdokumenta) as nazivdokumenta
      from sd_sifreg r
      join sd_sifrez z
        on z.sd_sifrez_id = r.sd_sifrez_id
     where trim(upper(z.dokumentid)) = 'OTPREMNICA'
     group by r.skladiste_id, r.dokument_id
),
line_totals as (
    select sd_glava_id,
           count(*) as line_count,
           sum(nvl(kolicina, 0)) as quantity_sum
      from sd_stavke
     group by sd_glava_id
),
dispatch_docs as (
    select g.id,
           m.skladiste_id,
           m.dokument_id,
           g.datum_dokumenta,
           g.datum_knjizenja,
           g.datum_izrade,
           nvl(lt.line_count, 0) as line_count,
           nvl(lt.quantity_sum, 0) as quantity_sum
      from sd_glava g
      join slot_mapping m
        on m.dokument_id = g.dokument_id
      left join line_totals lt
        on lt.sd_glava_id = g.id
     where nvl(g.knjizeno, 0) = 1
       and nvl(g.storno, 0) = 0
       and g.datum_storno is null
       and g.stornirao is null
)
select skladiste_id,
       to_char(datum_dokumenta, 'YYYY') as document_year,
       count(*) as booked_headers,
       sum(line_count) as line_count,
       sum(quantity_sum) as quantity_sum,
       min(to_char(datum_dokumenta, 'YYYY-MM-DD')) as first_document_date,
       max(to_char(datum_dokumenta, 'YYYY-MM-DD')) as last_document_date,
       min(to_char(datum_knjizenja, 'YYYY-MM-DD HH24:MI:SS')) as first_posted_at,
       max(to_char(datum_knjizenja, 'YYYY-MM-DD HH24:MI:SS')) as last_posted_at,
       min(dokument_id) as document_id_min,
       max(dokument_id) as document_id_max,
       count(distinct dokument_id) as distinct_document_ids
  from dispatch_docs
 group by skladiste_id, to_char(datum_dokumenta, 'YYYY')
 order by skladiste_id, document_year;

prompt
prompt === Booked OTPREMNICA by SKLADISTE_ID and posting year ===
prompt Secondary view: useful when DATUM_KNJIZENJA and DATUM_DOKUMENTA fall in different years.
prompt

with slot_mapping as (
    select r.skladiste_id,
           r.dokument_id
      from sd_sifreg r
      join sd_sifrez z
        on z.sd_sifrez_id = r.sd_sifrez_id
     where trim(upper(z.dokumentid)) = 'OTPREMNICA'
     group by r.skladiste_id, r.dokument_id
),
line_totals as (
    select sd_glava_id,
           count(*) as line_count,
           sum(nvl(kolicina, 0)) as quantity_sum
      from sd_stavke
     group by sd_glava_id
),
dispatch_docs as (
    select g.id,
           m.skladiste_id,
           m.dokument_id,
           g.datum_dokumenta,
           g.datum_knjizenja,
           nvl(lt.line_count, 0) as line_count,
           nvl(lt.quantity_sum, 0) as quantity_sum
      from sd_glava g
      join slot_mapping m
        on m.dokument_id = g.dokument_id
      left join line_totals lt
        on lt.sd_glava_id = g.id
     where nvl(g.knjizeno, 0) = 1
       and nvl(g.storno, 0) = 0
       and g.datum_storno is null
       and g.stornirao is null
)
select skladiste_id,
       to_char(datum_knjizenja, 'YYYY') as posted_year,
       count(*) as booked_headers,
       sum(line_count) as line_count,
       sum(quantity_sum) as quantity_sum,
       min(to_char(datum_dokumenta, 'YYYY-MM-DD')) as first_document_date,
       max(to_char(datum_dokumenta, 'YYYY-MM-DD')) as last_document_date,
       min(to_char(datum_knjizenja, 'YYYY-MM-DD HH24:MI:SS')) as first_posted_at,
       max(to_char(datum_knjizenja, 'YYYY-MM-DD HH24:MI:SS')) as last_posted_at,
       min(dokument_id) as document_id_min,
       max(dokument_id) as document_id_max,
       count(distinct dokument_id) as distinct_document_ids
  from dispatch_docs
 group by skladiste_id, to_char(datum_knjizenja, 'YYYY')
 order by skladiste_id, posted_year;

prompt
prompt === All OTPREMNICA states by SKLADISTE_ID and document date year ===
prompt This includes draft and cancelled rows, so you can spot old unfinished data too.
prompt

with slot_mapping as (
    select r.skladiste_id,
           r.dokument_id
      from sd_sifreg r
      join sd_sifrez z
        on z.sd_sifrez_id = r.sd_sifrez_id
     where trim(upper(z.dokumentid)) = 'OTPREMNICA'
     group by r.skladiste_id, r.dokument_id
),
dispatch_docs as (
    select g.id,
           m.skladiste_id,
           m.dokument_id,
           g.datum_dokumenta,
           nvl(g.knjizeno, 0) as knjizeno,
           case
             when nvl(g.storno, 0) = 1
               or g.datum_storno is not null
               or g.stornirao is not null then 1
             else 0
           end as cancelled
      from sd_glava g
      join slot_mapping m
        on m.dokument_id = g.dokument_id
)
select skladiste_id,
       to_char(datum_dokumenta, 'YYYY') as document_year,
       count(*) as created_headers,
       sum(case when knjizeno = 1 and cancelled = 0 then 1 else 0 end) as booked_headers,
       sum(case when knjizeno = 0 and cancelled = 0 then 1 else 0 end) as draft_headers,
       sum(case when cancelled = 1 then 1 else 0 end) as cancelled_headers,
       min(to_char(datum_dokumenta, 'YYYY-MM-DD')) as first_document_date,
       max(to_char(datum_dokumenta, 'YYYY-MM-DD')) as last_document_date,
       min(dokument_id) as document_id_min,
       max(dokument_id) as document_id_max,
       count(distinct dokument_id) as distinct_document_ids
  from dispatch_docs
 group by skladiste_id, to_char(datum_dokumenta, 'YYYY')
 order by skladiste_id, document_year;

prompt
prompt === Latest booked OTPREMNICA examples per SKLADISTE_ID/year ===
prompt

column rn format 999 heading 'RN'
column sd_glava_id format 999999999 heading 'SD_GLAVA_ID'
column dokumentbr format 999999999 heading 'DOKUMENTBR'
column partner_id format 999999999 heading 'PARTNER_ID'
column datum_dokumenta format a10 heading 'DOC_DATE'
column datum_knjizenja format a19 heading 'POSTED_AT'

select skladiste_id,
       document_year,
       sd_glava_id,
       dokument_id,
       dokumentbr,
       partner_id,
       datum_dokumenta,
       datum_knjizenja,
       rn
from (
    select x.*,
           row_number() over (
             partition by x.skladiste_id, x.document_year
             order by x.datum_knjizenja_date desc nulls last, x.sd_glava_id desc
           ) as rn
    from (
        select r.skladiste_id,
               to_char(g.datum_dokumenta, 'YYYY') as document_year,
               g.id as sd_glava_id,
               g.dokument_id,
               g.dokumentbr,
               g.partner_id,
               to_char(g.datum_dokumenta, 'YYYY-MM-DD') as datum_dokumenta,
               to_char(g.datum_knjizenja, 'YYYY-MM-DD HH24:MI:SS') as datum_knjizenja,
               g.datum_knjizenja as datum_knjizenja_date
          from sd_glava g
          join sd_sifreg r
            on r.dokument_id = g.dokument_id
          join sd_sifrez z
            on z.sd_sifrez_id = r.sd_sifrez_id
         where trim(upper(z.dokumentid)) = 'OTPREMNICA'
           and nvl(g.knjizeno, 0) = 1
           and nvl(g.storno, 0) = 0
           and g.datum_storno is null
           and g.stornirao is null
    ) x
)
where rn <= 5
order by skladiste_id, document_year, rn;

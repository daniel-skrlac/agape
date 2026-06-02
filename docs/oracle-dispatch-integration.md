# Oracle Dispatch Integration

This document describes the implemented AGAPE dispatch-note (`OTPREMNICA` /
`IZDATNICA`) flow. It is based on the running Oracle dump, the Java integration,
the mobile client, the Python analyzer, and real replay tests against Oracle.

## Architecture

The scanner is an input aid. Oracle remains the accounting and warehouse source
of truth.

1. The Expo mobile app captures or uploads a dispatch-slip image.
2. Mobile sends multipart form data to Quarkus:
   `POST /api/v1/dispatch-booking-sessions/{id}/entries/scan/parse`.
3. Quarkus checks the authenticated user and editable Postgres booking session.
4. Quarkus forwards the image to the Python analyzer:
   `POST /analyze-dispatch-slip`, multipart field `file`.
5. Python returns OCR suggestions, known-form quantity results, confidence,
   warnings, processing time, and image-quality metrics.
6. Quarkus resolves partner and article suggestions against current business
   data and returns an editable preview.
7. The user corrects uncertain partner, date, article, and quantity values.
8. Quarkus validates corrected lines before storing the booking-session entry.
9. Finalization builds Oracle dispatch requests and posts them through legacy
   PL/SQL.

OCR raw text, analyzer warnings, and uploaded scan files are not persisted in
Oracle or Postgres. There are no `dispatch_slip_scan` persistence tables.

## Scanner Responsibilities

The Python service uses the fixed geometry of the organization dispatch-slip
form. Positions 1 through 35 map to slip codes `0001` through `0035`. This is
form geometry, not hardcoded test-image data. Python does not dynamically OCR
article codes from boxes.

Python returns:

- detected partner number and text with confidence;
- detected document date with confidence;
- positive quantities keyed by slip code;
- per-quantity alternatives and crop confidence;
- warnings and image-quality information.

Quarkus remains responsible for business mapping:

- partner-number lookup first tries the detected number;
- if the detected number is below `1000`, lookup also tries `number + 1000`;
- partner-text search is a fallback;
- slip code is normalized to four digits and resolved to the real article for
  the selected warehouse;
- template document mapping is applied only when a template is selected;
- scan-only lines become extra items.

The mobile preview is intentionally editable. Handwriting OCR is advisory. A
low-confidence or incorrect value must be corrected before final save.

## Session Data

Postgres `dispatch_booking_session` stores the selected warehouse and lifecycle
status. `dispatch_booking_session_entry` stores the corrected partner entry,
optional template, document date, note, document patches, and extra items.

The scanner can be used with or without a template:

- template plus scan: mapped template lines become `doc_patches`;
- template plus additional articles: unmapped lines become `extra_items`;
- scan-only: all lines become `extra_items`;
- manual-only: manually added positive items become `extra_items`.

The selected session warehouse is propagated into each final Oracle request.

## Warehouse And Document Resolution

Oracle `DOKUMENT_ID` is a warehouse-specific slot. It must not be hardcoded.

The Java backend resolves it through:

```sql
select distinct r.dokument_id
  from sd_sifreg r
  join sd_sifrez z
    on z.sd_sifrez_id = r.sd_sifrez_id
 where r.skladiste_id = :warehouse_id
   and z.dokumentid = :logical_document_code;
```

`DocumentSlotRepository.resolveDocumentIdForWarehouseAndCode` rejects ambiguous
configuration rather than using unsafe `ROWNUM = 1` behavior.

For scan-only dispatch, the logical code is `OTPREMNICA`. For template booking,
the configured template document is translated to the corresponding logical
code and then resolved again for the selected warehouse.

The imported dump currently resolves `OTPREMNICA` as:

| Warehouse | `DOKUMENT_ID` | `SD_SIFREZ_ID` | Stock booking |
| --- | ---: | ---: | ---: |
| 1 | 3 | 3 | 1 |
| 2 | 9 | 9 | 1 |
| 3 | 23 | 3 | 1 |
| 4 | 32 | 9 | 1 |
| 5 | 41 | 3 | 1 |
| 6 | 50 | 9 | 1 |

These values are database configuration examples, not Java constants.

## Oracle Session Context

Legacy packages depend on package globals. All context initialization,
preparation, and final procedure calls that belong together must use the same
JDBC connection.

Java initializes context with:

```plsql
begin
  KNJIZI_MK.CITAJ_GLOBALNO(:dokument_id);
  GLO.DOKUMENT_ID := :dokument_id;
  GLO.OPERATER(:authenticated_oib);
end;
```

The authenticated operator OIB is used for draft line insertion, update,
posting, and storno. The configured operator is only a fallback where an
authenticated actor is unavailable.

## Draft Creation

`DispatchBookingTransactionService.createDraft` performs these operations on
one Oracle connection:

1. initialize legacy context;
2. insert `SD_GLAVA`;
3. insert `SD_STAVKE`;
4. run legacy-compatible preparation;
5. commit the prepared draft.

Java supplies header input values including:

- resolved `DOKUMENT_ID`;
- document date when supplied;
- selected `PARTNER_ID`;
- authenticated actor as `IZRADIO`;
- note;
- compatibility defaults `BROJJEDINICAV=1`, `PREPORUCENAMARZA=0`,
  `RABATSTOPA=0`, and `IZNOSZT=0`.

Oracle trigger `SD_GLAVA_BIU` supplies or normalizes:

- `ID` from `SD_GLAVA_SEQ`;
- `DOKUMENTBR` within the selected `DOKUMENT_ID`;
- missing document and creation dates;
- `STORNO=0` and `KNJIZENO=0`;
- fallback `IZRADIO` from `GLO.OIB_OPERATERA`.

Java inserts each line by selecting the article snapshot from `SKLADISTE`
(`CJENIK_ID=1`). Important snapshots include:

- article, name, VAT, and unit IDs;
- goods/service flags;
- quantity;
- `CIJENAFAK`, `CIJENAFAK1`, `CIJENANAB`, `CIJENANAB_`, `CIJENAZA`;
- sales price fields;
- currency compatibility values;
- authenticated line creator from `GLO.GET_OIB_OPERATERA()`.

`CIJENANAB_` and `CIJENAZA` are explicitly copied because the legacy
`SD_STAVKE_BI` trigger does not fill them.

## Oracle Triggers

Relevant triggers observed in the imported dump:

- `SD_GLAVA_BIU`: header defaults, sequence ID, per-slot document number,
  creator fallback, and modification date.
- `SD_GLAVA_BD` / `SD_GLAVA_AD`: prevent deletion of posted documents and
  clean legacy logs.
- `SD_STAVKE_BI`: line defaults, stock-change mode, sequence ID, line number,
  and article/name relationships.
- `SD_STAVKE_BU`: update normalization and line modification date.
- `SD_STAVKE_AIU` / `SD_STAVKE_AD`: maintain unposted stock movement counters
  in `SKL_APROMETI` while drafts change.

Draft replacement updates delete existing lines and insert corrected lines.
The header records authenticated `IZMIJENIO` and `DATUM_IZMJENE`.

## Legacy Preparation

Calling `KNJIZI_MK.KNJIZI_MK_DOKUMENT` with incomplete rows is insufficient.
Before posting, `LegacyBookingPreparationRepository.prepareDraftForBooking`
repairs older drafts and delegates formulas to Oracle.

For each line it:

1. reloads the current `SKLADISTE` article snapshot where required;
2. preserves the draft stock snapshot;
3. ensures required compatibility fields are non-null;
4. calls `KNJIZI_MK.RACUNAJ_STA`;
5. calls `KNJIZI_MK.RACUNAJ_RABAT_STA_I` for output documents or
   `KNJIZI_MK.RACUNAJ_RABAT_STA_U` for input documents;
6. writes the calculated row back.

For the header it:

1. updates `BROJSTAVAKA`;
2. fills `SIFRATEKSTA` from the resolved logical document type;
3. ensures compatibility defaults;
4. calls `ZBROJI_DOKUMENTE.ZBROJI_STA_SDG`.

The repository rejects preparation if no lines exist or calculated line fields
remain null.

## Posting

`DispatchBookingTransactionService.postViaProcedure` reloads slot metadata from
Oracle and calls:

```plsql
KNJIZI_MK.KNJIZI_MK_DOKUMENT(
  :sd_glava_id,
  :authenticated_oib,
  :knjiziti_na_skladiste,
  :knjiziti_uk_popisa,
  :knjiziti_normative,
  :generiraj_zapisnik,
  :azuriraj_prodajne,
  :azuriraj_nabavne
);
```

The first three booking switches come from `SD_SIFREZ`, not application
properties. Remaining arguments are external invocation switches.

The package copies and processes temporary lines, updates stock/card data,
aggregates values, and commits internally. Java therefore executes posting
outside a JTA transaction and uses one explicit JDBC connection.

PL/SQL can log an error without throwing it back to Java. After the call,
`DocumentRepository.assertDocumentBooked` verifies:

- `SD_GLAVA.KNJIZENO=1`;
- `KNJIZIO` is filled;
- `DATUM_KNJIZENJA` is filled.

If verification fails, Java returns an error including the latest
`KNJIZI_LOG` row where available.

## Storno

Posted cancellation uses:

```plsql
STORNO_MK.STORNO_MK_DOKUMENT(
  :sd_glava_id,
  :storno_na_skladiste,
  :storno_uk_popisa,
  :storno_veznid,
  :postavi_oznaku
);
```

Before this call Java initializes `GLO.OPERATER` on the same connection.
This matters because `STORNO_MK.STORNO_IZNOSI_SDG` writes:

- `KNJIZENO=0`;
- `STORNO=1` when configured;
- `STORNIRAO=GLO.OIB_OPERATERA`;
- `DATUM_STORNO=SYSDATE`.

After the procedure Java verifies those four results. It does not mask missing
Oracle context by manually writing `STORNIRAO`. The optional cancellation note
is stored after successful legacy storno.

## Value Ownership

| Values | Owner |
| --- | --- |
| selected warehouse, corrected partner, corrected date, corrected quantities | mobile user through Quarkus |
| scan suggestions, confidence, image quality | Python analyzer |
| warehouse-specific `DOKUMENT_ID` | Oracle `SD_SIFREG` / `SD_SIFREZ`, resolved by Java |
| header insert defaults needed for compatibility | Java plus `SD_GLAVA_BIU` |
| line article and price snapshot | Java from Oracle `SKLADISTE` |
| line formulas and header totals | Oracle packages called by Java |
| final posting state and stock cards | `KNJIZI_MK` |
| cancellation state and card removal | `STORNO_MK` |

## Mobile State

The mobile app treats the analyzer response as editable preview data. Saving a
preview stores corrected session-entry data. Finalization reflects the Oracle
bulk response.

Bulk posting supports partial results. A finalized session is locked to avoid
accidentally replaying already successful entries and creating duplicate Oracle
documents. Mobile displays partial failure details immediately, while Postgres
keeps the full `finalResult` JSON for later inspection.

## Real Replay Verification

The following scenarios were executed against the imported running dump:

- mobile-equivalent scanner session, warehouse 5, parsed image through Quarkus
  and Python, corrected-entry save, final posting;
- draft create, draft line replacement update, posting, repeated posting,
  storno, and repeated storno.

Observed scanner replay result:

- warehouse 5 resolved to `DOKUMENT_ID=41`;
- Java-created header `11826`;
- `KNJIZENO=1`, authenticated `KNJIZIO`, and posting timestamp;
- 22 persisted lines, quantity sum 34;
- zero null `CIJENANAB_`, `CIJENAZA`, or `IZNOSZT` line fields;
- 22 `SKLKARTICE` rows with output quantity sum 34;
- one `SD_PDV` row;
- success row in `KNJIZI_LOG`.

Observed lifecycle replay result:

- draft header `11825`;
- create and update actor snapshots matched authenticated actor;
- duplicate post returned `400 Already POSTED`;
- storno removed both stock-card rows;
- `KNJIZENO=0`, `STORNO=1`, authenticated `STORNIRAO`, and storno timestamp;
- duplicate storno returned `400 Cannot cancel: already CANCELLED`.

Replay IDs are diagnostic examples only. No production code depends on them.

## Troubleshooting SQL

Inspect a dispatch header:

```sql
select *
  from sd_glava
 where id = :sd_glava_id;
```

Inspect lines:

```sql
select *
  from sd_stavke
 where sd_glava_id = :sd_glava_id
 order by stavkabr, id;
```

Resolve warehouse document configuration:

```sql
select r.skladiste_id,
       r.dokument_id,
       r.sd_sifrez_id,
       z.dokumentid,
       z.nazivdokumenta,
       z.ulazizlaz,
       z.knjizitinaskladiste,
       z.knjizitiukpopisa,
       z.knjizitinormative
  from sd_sifreg r
  join sd_sifrez z
    on z.sd_sifrez_id = r.sd_sifrez_id
 where r.skladiste_id = :warehouse_id
   and z.dokumentid = 'OTPREMNICA';
```

Check real posting success:

```sql
select id, dokument_id, dokumentbr, knjizeno, knjizio, datum_knjizenja,
       storno, stornirao, datum_storno
  from sd_glava
 where id = :sd_glava_id;
```

Inspect cards and tax aggregation:

```sql
select * from sklkartice where sd_glava_id = :sd_glava_id order by stavkabr, id;
select * from sd_pdv where sd_glava_id = :sd_glava_id;
```

Inspect legacy logs:

```sql
select datum, pckg_name, proc_name, greska, poruka
  from knjizi_log
 where id_dokumenta = :sd_glava_id
 order by datum, id;
```

Compare one same-configuration legacy and Java document:

```bash
docker compose --env-file infra/.env -f infra/docker-compose.db.yml exec -T oracle-xe \
  sh -lc 'sqlplus -L -s "$APP_USER/$APP_USER_PASSWORD@//localhost:1521/XE" \
  @/diagnostics/compare_dispatch_documents.sql OLD_SD_GLAVA_ID NEW_SD_GLAVA_ID'
```

The read-only script first checks that the two records use the same
`DOKUMENT_ID` and warehouse, then compares headers, null-versus-zero profiles,
lines, `SD_PDV`, `SKLKARTICE`, logs, and direct `SD_GLAVA_ID` side-effect tables.

## Known Assumptions And Risks

- The integration depends on the imported legacy package and trigger behavior.
  Re-imported schemas must be checked with the comparison script.
- Legacy posting and storno packages commit internally. Java can verify failure
  after the call but cannot roll back work already committed inside PL/SQL.
- OCR is not accounting truth. Ambiguous handwriting must remain editable.
- Partial bulk posting is locked and surfaced to the operator to avoid unsafe
  replay. Repairing a partial session requires inspecting its persisted final
  result and affected Oracle headers.
- `SKLADISTE.CJENIK_ID=1` is the legacy article snapshot source currently used
  by the imported schema and must be revisited if legacy price-list rules
  change.

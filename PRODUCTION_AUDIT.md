# Agape Production Audit

Updated: 2026-07-02 21:05 Europe/Zagreb

This audit was continued from the missing-gate request. `PRODUCTION_AUDIT.md` and `TEST_COVERAGE_MATRIX.md` were not present when this pass started, so this file records the evidence collected during this continuation instead of summarizing prior unverified claims.

## Executive Status

Not production-ready yet.

Verified working gates:

- Backend starts after a clean restart and reports Quarkus health `UP`.
- Postgres and Oracle health checks report `UP`.
- Dispatch slip analyzer health reports `UP`.
- Expo/Metro serves the app locally on port `8081`.
- Backend unit tests pass: 6 tests.
- Frontend TypeScript passes.
- Expo doctor passes 17/17 after package alignment and adaptive icon fix.
- Analyzer Python syntax check passes.
- Compose app config renders successfully.
- Real scan parse, validate, save, overwrite, and database readback were executed.

Remaining blockers:

- `npm audit --omit=dev --audit-level=moderate` still reports 22 vulnerabilities, including 1 critical. Some suggested fixes require breaking Expo upgrades.
- Local Node is `v20.19.0`; updated React Native/Metro packages request `>=20.19.4`. Commands still ran, but the environment should be updated before release builds.
- Native iOS/Android device workflows were not manually exercised in this terminal-only pass.
- Oracle final booking comparison against legacy `SD_GLAVA` / `SD_STAVKE` records was not executed in this pass.
- Full endpoint-by-endpoint negative/permission/concurrency matrix is not complete.

## Fixes Applied In This Pass

### Service Response HTTP Status

Problem: Several resources returned `ServiceResponseDTO` directly. Failed service responses could be serialized with HTTP 200 unless the resource explicitly wrapped them with `Responses.from(...)`.

Fix:

- Added `agape-api/src/main/java/hr/agape/common/response/ServiceResponseStatusFilter.java`.
- Added `agape-api/src/test/java/hr/agape/common/response/ServiceResponseStatusFilterTest.java`.

Evidence:

- Duplicate registration now returns HTTP `409`, body status `409`.
- Wrong password login now returns HTTP `400`, body status `400`.
- `mvn test` passes all 6 tests.

### Scan Confidence Mapping

Problem: MapStruct treated `BookingSessionScanEntryMapper.resolveScanNote(String)` as a general String converter and mapped null `confidenceLevel` to `Skenirano sa papira`.

Fix:

- Made `resolveScanNote` private inside `BookingSessionScanEntryMapper`, so MapStruct no longer applies it to unrelated string fields.

Evidence:

- Live scan validate after fix returned first line `confidenceLevel=UNKNOWN`, not `Skenirano sa papira`.
- Save still succeeded and persisted enriched item names.

### Expo Project Health

Problems:

- `expo-doctor` failed due SDK patch mismatches.
- `expo-doctor` failed because `assets/images/adaptive-icon.png` was `941x1672`, not square.
- TypeScript failed after package alignment because `expo-asset` was imported directly but not declared.

Fix:

- Ran `npx expo install --fix`.
- Added declared `expo-asset` dependency using `npx expo install expo-asset`.
- Padded `assets/images/adaptive-icon.png` to `1672x1672` RGBA.

Evidence:

- `npx expo-doctor` now passes 17/17.
- `npx tsc --noEmit` now passes.
- Expo serves `http://127.0.0.1:8081` with HTTP 200.

## Inventory Evidence

Generated artifacts:

- Backend endpoint inventory: `/tmp/agape-audit-evidence/backend_endpoint_inventory.txt`
- Frontend route inventory: `/tmp/agape-audit-evidence/frontend_route_inventory.txt`

Counts:

- Backend resource methods found by inventory script: 58
- Frontend app route/layout files: 32

## Commands Executed

Backend:

```bash
cd agape-api
mvn test
mvn quarkus:dev -Dquarkus.analytics.disabled=true
curl -i http://127.0.0.1:8080/q/health
```

Frontend:

```bash
cd agape-mobile
npx expo install --fix
npx expo install expo-asset
npx expo-doctor
npx tsc --noEmit
npm audit --omit=dev --audit-level=moderate
npx expo start --localhost --web
curl -i http://127.0.0.1:8081
```

Analyzer:

```bash
cd dispatch-slip-analyzer
python3 -m py_compile app/*.py
curl -i http://127.0.0.1:8091/health
curl -sS -F "file=@/home/daniel/Pictures/WhatsApp Image 2026-07-01 at 17.49.03.jpeg;type=image/jpeg" \
  http://127.0.0.1:8091/analyze-dispatch-slip
```

Infra:

```bash
cd infra
docker compose --env-file .env -f docker-compose.app.yml config
docker compose --env-file .env -f docker-compose.db.yml ps
docker compose --env-file .env -f docker-compose.app.yml ps
```

Database readback:

```sql
SELECT id, session_id, partner_id, template_id, draft_mode, document_date, note,
       jsonb_array_length(COALESCE(extra_docs, '[]'::jsonb)) AS extra_doc_count,
       jsonb_array_length(COALESCE(extra_docs -> 0 -> 'items', '[]'::jsonb)) AS first_extra_doc_items,
       extra_docs -> 0 ->> 'documentId' AS first_document_id,
       extra_docs -> 0 -> 'items' -> 0 ->> 'itemId' AS first_item_id,
       extra_docs -> 0 -> 'items' -> 0 ->> 'quantity' AS first_quantity
FROM dispatch_booking_session_entry
WHERE session_id = 2
ORDER BY id;
```

Result:

```text
id|session_id|partner_id|template_id|draft_mode|document_date|note|extra_doc_count|first_extra_doc_items|first_document_id|first_item_id|first_quantity
4|2|1084||FINAL|2025-09-25|Skenirano sa papira|1|22|3|61|2
```

Overwrite verification:

```text
OVERWRITE_HTTP 200
rows_for_partner|first_quantity_after_overwrite
1|7

RESTORE_HTTP 200
rows_for_partner|first_quantity_after_restore
1|2
```

## Scan Flow Evidence

Direct Python analyzer with `/home/daniel/Pictures/WhatsApp Image 2026-07-01 at 17.49.03.jpeg`:

- HTTP `200`
- `partnerNumber=293`
- `partnerText=RENATO VIDEC`
- `documentDate=2025-09-25`
- `processingMs=973`
- `quantities_count=22`
- `imageQuality.paperDetectionConfidence=0.9714`
- `imageQuality.gridDetectionConfidence=0.98`
- `imageQuality.detectedCellCount=35`
- warning: `8 quantities have low confidence and should be checked.`

Backend parse without selected scan document:

- HTTP `400`
- message: `Odaberi grupu otpremnice prije analize skena.`

Backend parse with `documentId=3`:

- HTTP `200`
- partner resolved to `partnerId=1084`, `partnerName=Videc Renato`
- `documentId=3`, `warehouseId=1`
- `documentDate=2025-09-25`
- `allValid=true`
- 22 resolved lines
- first line: item `61`, code `0001`, name `Brašno`, quantity `2`

Backend validate/save:

- validate HTTP `200`, `allValid=true`
- save HTTP `200`
- saved entry id `4`
- saved as `extraDocs[0].documentId=3`
- saved 22 item rows with enriched names

## Security And Authorization Evidence

Anonymous probes:

- `/api/v1/users`: HTTP `401`
- `/api/v1/dispatch-templates`: HTTP `401`
- `/api/v1/dispatch-booking-sessions`: HTTP `401`
- `/api/v1/warehouses`: HTTP `401`

Authenticated probes:

- user registration: HTTP `200`
- duplicate username: HTTP `409`
- invalid registration: HTTP `400`
- login: HTTP `200`
- wrong password: HTTP `400`
- session owner can fetch created session: HTTP `200`
- different user fetching session: HTTP `404`

## Known Gaps

- No physical iOS camera/gallery scanner pass was executed here.
- No real Oracle booking/finalization comparison was completed here.
- No EAS native release build was run.
- No exhaustive endpoint invalid-input matrix was completed.
- npm audit remains non-green.
- The current local Node patch version should be upgraded to satisfy React Native/Metro engines.


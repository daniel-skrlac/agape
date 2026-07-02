# Test Coverage Matrix

Updated: 2026-07-02 21:05 Europe/Zagreb

Statuses:

- PASS: executed and verified in this pass.
- PARTIAL: meaningful evidence collected, but not exhaustive.
- BLOCKED: cannot be completed in this terminal-only pass or requires an environment change.
- NOT VERIFIED: not executed yet.

| Area | Status | Evidence |
| --- | --- | --- |
| Audit files existed before continuation | BLOCKED | `rg --files -g 'PRODUCTION_AUDIT.md' -g 'TEST_COVERAGE_MATRIX.md'` and `find ...` found no files. Created fresh files in this pass. |
| Backend endpoint inventory | PASS | `/tmp/agape-audit-evidence/backend_endpoint_inventory.txt`, 58 resource methods found. |
| Frontend screen inventory | PASS | `/tmp/agape-audit-evidence/frontend_route_inventory.txt`, 32 route/layout files. |
| Postgres container health | PASS | Docker compose shows `infra-postgres-1` healthy; Quarkus health reports Postgres `UP`. |
| Oracle container health | PASS | Docker compose shows `infra-oracle-xe-1` healthy; Quarkus health reports Oracle `UP`. |
| Analyzer container health | PASS | `curl -i http://127.0.0.1:8091/health` returned HTTP 200 `{"status":"UP"}`. |
| Quarkus health | PASS | `curl -i http://127.0.0.1:8080/q/health` returned HTTP 200, status `UP`. |
| Expo dev server | PASS | `npx expo start --localhost --web`; `curl -i http://127.0.0.1:8081` returned HTTP 200. |
| Backend tests | PASS | `mvn test`: Tests run 6, Failures 0, Errors 0. |
| Frontend typecheck | PASS | `npx tsc --noEmit` exited 0 after declaring `expo-asset`. |
| Expo doctor | PASS | `npx expo-doctor`: 17/17 checks passed. |
| Python syntax | PASS | `python3 -m py_compile app/*.py` exited 0. |
| Docker app compose config | PASS | `docker compose --env-file .env -f docker-compose.app.yml config` exited 0. |
| Git whitespace check | PASS | `git diff --check` exited 0. |
| Anonymous auth protection | PASS | Users, templates, sessions, warehouses returned HTTP 401 anonymously. |
| Registration happy path | PASS | `register1`: HTTP 200. |
| Registration duplicate username | PASS | HTTP 409 after `ServiceResponseStatusFilter` fix. |
| Registration validation error | PASS | Invalid request returned HTTP 400. |
| Login happy path | PASS | `login1`: HTTP 200 with token. |
| Login wrong password | PASS | HTTP 400 after `ServiceResponseStatusFilter` fix. |
| Session create | PASS | Valid create payload returned HTTP 200, session id 2. |
| Session owner read | PASS | Owner GET session 2 returned HTTP 200. |
| Session cross-user isolation | PASS | Different user GET session 2 returned HTTP 404. |
| Direct analyzer scan | PASS | HTTP 200, partnerNumber 293, date 2025-09-25, 22 quantities, 35 detected cells. |
| Backend scan parse missing document | PASS | HTTP 400, Croatian error asking for dispatch group. |
| Backend scan parse selected document | PASS | HTTP 200, partnerId 1084, documentId 3, warehouseId 1, allValid true, 22 resolved lines. |
| Backend scan validate | PASS | HTTP 200, `allValid=true`; after mapper fix confidence level is `UNKNOWN` when user-edited payload omits confidence. |
| Backend scan save | PASS | HTTP 200, entry id 4, 1 extraDoc, 22 enriched items. |
| Scan DB persistence | PASS | Postgres row: `session_id=2`, `partner_id=1084`, `document_date=2025-09-25`, `extra_doc_count=1`, `first_extra_doc_items=22`. |
| Same partner scan replacement | PASS | Re-saving changed first quantity from 2 to 7 kept one row; restoring set it back to 2, still one row. |
| Item-name enrichment in saved scan response | PASS | Save response included item names such as `Brašno`, `Šećer`, `Mljeko`. |
| Frontend actual iOS camera capture | NOT VERIFIED | Requires physical device/simulator interaction outside terminal. |
| Frontend gallery picker on iOS | NOT VERIFIED | Requires physical device/simulator interaction outside terminal. |
| Frontend scanner correction UI manual workflow | NOT VERIFIED | API flow verified; manual UI interaction not performed. |
| Template creation/edit/delete full workflow | PARTIAL | Typecheck/build pass; not fully API exercised in this continuation. |
| Template dispatch multi-document UI workflow | PARTIAL | Typecheck/build pass; not manually exercised on device. |
| Session finalize to Oracle | NOT VERIFIED | Scan entry persisted in Postgres; final Oracle booking was not run in this pass. |
| Legacy Oracle comparison `SD_GLAVA` / `SD_STAVKE` | NOT VERIFIED | Mandatory for final production claim, but not executed in this continuation. |
| Full endpoint-by-endpoint negative tests | PARTIAL | Critical auth/session/scan paths tested; complete 58-method matrix not executed. |
| Security audit dependency scan | BLOCKED | `npm audit --omit=dev --audit-level=moderate` still reports 22 vulnerabilities, including 1 critical. Some fixes require breaking Expo major upgrade. |
| Node runtime version | BLOCKED | Local Node is `v20.19.0`; updated Metro/React Native packages warn they require `>=20.19.4`. |
| Native release build | NOT VERIFIED | No EAS/iOS/Android release build run in this pass. |


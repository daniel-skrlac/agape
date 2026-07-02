# Dispatch Warehouse/Year Report

Generated from the local Oracle legacy dump on 2026-06-05.

Source tables:

- `SD_GLAVA`
- `SD_STAVKE`
- `SD_SIFREG`
- `SD_SIFREZ`

Filter:

- logical document code: `SD_SIFREZ.DOKUMENTID = 'OTPREMNICA'`
- booked only: `SD_GLAVA.KNJIZENO = 1`
- cancelled/storno rows excluded from the main booked report

## OTPREMNICA Mapping

| SKLADISTE_ID | DOKUMENT_ID | SD_SIFREZ_ID | DOCUMENT_CODE | DOCUMENT_NAME | ULAZIZLAZ | MIJENJAZALIHU |
|---:|---:|---:|---|---|---:|---:|
| 1 | 3 | 3 | OTPREMNICA | IZDATNICA | 4 | 0 |
| 2 | 9 | 9 | OTPREMNICA | IZDATNICA | 4 | 0 |
| 3 | 23 | 3 | OTPREMNICA | IZDATNICA | 4 | 0 |
| 4 | 32 | 9 | OTPREMNICA | IZDATNICA | 4 | 0 |
| 5 | 41 | 3 | OTPREMNICA | IZDATNICA | 4 | 0 |
| 6 | 50 | 9 | OTPREMNICA | IZDATNICA | 4 | 0 |

## Booked OTPREMNICA By Document Year

This is the main confirmation table for which `SKLADISTE_ID` is used for which document year.

| SKLADISTE_ID | Document year | Booked headers | Lines | Quantity sum | First document date | Last document date | First posted at | Last posted at | DOKUMENT_ID |
|---:|---:|---:|---:|---:|---|---|---|---|---:|
| 1 | 2024 | 1849 | 33110 | 52123.000 | 2024-01-02 | 2024-12-30 | 2024-02-06 15:49:16 | 2025-01-02 08:27:27 | 3 |
| 1 | 2025 | 8 | 180 | 260.000 | 2025-09-15 | 2025-09-15 | 2026-06-01 20:46:27 | 2026-06-03 15:32:44 | 3 |
| 1 | 2026 | 9 | 47 | 61.000 | 2026-06-01 | 2026-06-05 | 2026-06-01 16:10:16 | 2026-06-05 14:29:31 | 3 |
| 2 | 2024 | 536 | 725 | 8805.000 | 2024-03-20 | 2024-12-21 | 2024-04-05 08:15:11 | 2024-12-30 11:51:04 | 9 |
| 3 | 2025 | 1545 | 30251 | 49554.000 | 2025-01-07 | 2025-12-30 | 2025-01-16 16:37:29 | 2026-01-10 17:35:31 | 23 |
| 4 | 2025 | 1234 | 2812 | 25185.842 | 2025-01-15 | 2025-12-30 | 2025-02-04 16:10:26 | 2026-01-10 17:12:00 | 32 |
| 5 | 2025 | 3 | 66 | 102.000 | 2025-09-15 | 2025-09-15 | 2026-06-02 17:06:08 | 2026-06-02 17:31:00 | 41 |
| 5 | 2026 | 866 | 13684 | 23536.000 | 2026-01-02 | 2026-05-26 | 2026-02-07 17:18:27 | 2026-05-27 16:00:58 | 41 |
| 6 | 2026 | 615 | 1657 | 5265.113 | 2026-01-08 | 2026-05-14 | 2026-02-12 14:20:51 | 2026-05-27 15:16:22 | 50 |

## All OTPREMNICA States By Document Year

This includes booked, draft, and cancelled rows.

| SKLADISTE_ID | Document year | Created | Booked | Draft | Cancelled | First document date | Last document date | DOKUMENT_ID |
|---:|---:|---:|---:|---:|---:|---|---|---:|
| 1 | 2024 | 1930 | 1849 | 0 | 81 | 2024-01-02 | 2024-12-30 | 3 |
| 1 | 2025 | 8 | 8 | 0 | 0 | 2025-09-15 | 2025-09-15 | 3 |
| 1 | 2026 | 9 | 9 | 0 | 0 | 2026-06-01 | 2026-06-05 | 3 |
| 2 | 2024 | 560 | 536 | 0 | 24 | 2024-03-20 | 2024-12-21 | 9 |
| 3 | 2025 | 1716 | 1545 | 0 | 171 | 2025-01-07 | 2025-12-30 | 23 |
| 4 | 2025 | 1272 | 1234 | 0 | 38 | 2025-01-15 | 2025-12-30 | 32 |
| 5 | 2025 | 3 | 3 | 0 | 0 | 2025-09-15 | 2025-09-15 | 41 |
| 5 | 2026 | 989 | 866 | 0 | 123 | 2026-01-02 | 2026-06-02 | 41 |
| 6 | 2026 | 645 | 615 | 0 | 30 | 2026-01-08 | 2026-05-14 | 50 |

## Conclusion

- `SKLADISTE_ID=6` is definitely used for 2026 dispatches in the legacy data.
- For `SKLADISTE_ID=6`, the dispatch document slot is `DOKUMENT_ID=50`.
- `SKLADISTE_ID=5` is also used for many 2026 dispatches, with `DOKUMENT_ID=41`, so warehouse/year selection is not a pure calendar-year rule by itself.
- `SKLADISTE_ID=1` contains mostly 2024 dispatches, but also a few later test/new-app rows in 2025 and 2026.
- The app should present this selection as a legacy `skladište/godina/katalog`, not as a simple physical warehouse.

## Run Command

```bash
docker compose --env-file infra/.env -f infra/docker-compose.db.yml exec -T oracle-xe \
  sh -lc 'sqlplus -L -s "$APP_USER/$APP_USER_PASSWORD@//localhost:1521/XE"' \
  < infra/oracle/diagnostics/dispatch_warehouse_year_report.sql
```


# Agape Application - Technical and Functional Documentation

## 1. Purpose

Agape is a warehouse and dispatch management system for articles, partners, dispatch templates, booking sessions, dispatch scanning, validation, and posting into the legacy Oracle AGAPE system.

The main goal is to support fast and controlled mobile operations:

- view current stock by selected warehouse,
- manage dispatch templates,
- create booking sessions by partner,
- add items from templates, manual extra items, and scanned paper dispatch forms,
- validate quantities before posting,
- post documents through the backend while respecting legacy Oracle rules.

The system consists of:

- Expo mobile application (`agape-mobile`),
- Quarkus backend (`agape-api`),
- Python dispatch form analyzer (`dispatch-slip-analyzer`),
- infrastructure scripts and compose files (`infra`),
- legacy Oracle database and business logic.

## 2. High-Level Architecture

### 2.1. Mobile Application

The mobile app is the operational user interface. It does not post directly to Oracle and it does not call the Python analyzer directly.

Responsibilities:

- user authentication,
- warehouse selection,
- stock and session display,
- template management,
- booking session editing,
- capturing or uploading paper dispatch images,
- displaying analyzer results and allowing corrections,
- sending final user-confirmed data to the backend.

### 2.2. Quarkus Backend

The backend is the source of truth for security, validation, and business integration.

Responsibilities:

- JWT authentication and authorization,
- session ownership checks,
- partner, item, document, and warehouse lookup,
- stock and quantity validation,
- mapping scanned article codes to real items,
- merging scanned data into session entries,
- preparing booking requests,
- calling Oracle procedures and verifying posting results.

### 2.3. Python Analyzer

The Python service analyzes paper dispatch images and returns structured data.

Responsibilities:

- image decoding,
- paper and grid normalization,
- OCR for partner and date fields,
- quantity extraction from the known 35-cell paper layout,
- returning values, confidence scores, warnings, and image quality metrics.

The Python service must not:

- write to the database,
- make final business decisions,
- persist scan history,
- post documents.

### 2.4. Legacy Oracle System

The Oracle database and PL/SQL procedures are the legacy business system. The backend must use Oracle configuration and procedures where they represent existing AGAPE behavior.

Important rules:

- `DOKUMENT_ID` must be resolved from warehouse and document type configuration,
- the selected mobile warehouse must be respected end to end,
- procedures that depend on Oracle package/session context must be called on the same connection,
- a posting call is not considered successful only because no exception was thrown; the resulting Oracle state must be checked.

## 3. Backend Modules

### 3.1. `hr.agape.user`

Handles users, authentication, JWT tokens, and user settings.

Responsibilities:

- registration,
- login,
- current user lookup,
- default warehouse updates,
- user identity checks through `AuthUtil`.

### 3.2. `hr.agape.partner`

Handles partners.

Responsibilities:

- partner lookup by ID,
- partner search by name,
- partner search by partner number,
- partner usage in booking sessions and posting.

During dispatch image analysis, partner resolution can use:

- manually selected partner,
- detected partner number,
- fallback rule: if detected number is below 1000, also try number + 1000,
- textual candidates when the number is unreliable.

### 3.3. `hr.agape.item`

Handles items/articles.

Responsibilities:

- item lookup by warehouse,
- item search,
- mapping paper dispatch article codes to real items,
- loading item metadata for frontend display.

Important rule: scan mapping uses the article code from the dispatch form, not a manually typed arbitrary item ID.

### 3.4. `hr.agape.stock`

Handles stock overview.

Responsibilities:

- total stock overview,
- most stocked items,
- items needing refill,
- zero or missing stock items,
- warehouse-scoped stock data.

The mobile home screen should show the currently selected warehouse state, not a global summary that can confuse the user.

### 3.5. `hr.agape.template`

Handles templates and booking sessions.

Core concepts:

- template: configured group of dispatch documents and items,
- template document: a document block that can later become an Oracle document,
- session: operational dispatch group, usually for a day or workflow,
- session entry: one partner entry inside a session.

A session entry can contain:

- `templateId`,
- `docPatches`,
- `extraItems`,
- note,
- document date,
- `DRAFT` or `FINAL` mode.

### 3.6. `hr.agape.dispatch`

Handles dispatch validation and posting.

Responsibilities:

- validate available quantities,
- calculate warehouse impact,
- prepare booking requests,
- call Oracle integration,
- return posting results to the mobile app.

### 3.7. `hr.agape.dispatch.scan`

Handles paper dispatch scanning.

Flow:

1. The mobile app sends an image to the backend.
2. The backend checks user and session permissions.
3. The backend sends the image to the Python analyzer.
4. Python returns partner, date, quantities, confidence scores, and warnings.
5. The backend maps partner and items.
6. The frontend displays an editable preview.
7. The user corrects the data.
8. The backend validates final data.
9. The backend saves confirmed lines into the session entry.

Scan results are not persisted as OCR history. Only the final confirmed session entry is saved.

## 4. Mobile Application Segments

### 4.1. Authentication

Screens:

- `app/(auth)/index.tsx`
- `app/(auth)/register.tsx`

Responsibilities:

- login,
- registration,
- token storage,
- navigation into the main app.

### 4.2. Home

Screen:

- `app/(tabs)/home.tsx`

Responsibilities:

- show selected warehouse state,
- show high-stock items,
- show items needing refill,
- show items without stock,
- refresh stock data.

All data must be scoped to the warehouse selected by the user.

### 4.3. Settings

Screen:

- `app/(tabs)/settings.tsx`

Responsibilities:

- update default warehouse,
- show user settings,
- logout.

### 4.4. Templates

Screens:

- `app/(tabs)/templates/index.tsx`
- `app/(tabs)/templates/folder/[folderId].tsx`
- `app/(tabs)/templates/template/[id].tsx`
- `app/(tabs)/templates/template/[id]/documents.tsx`
- `app/(tabs)/templates/template/[id]/dispatch.tsx`

Responsibilities:

- organize templates in folders,
- create and edit templates,
- add documents and items to templates,
- dispatch from a template to one or more partners.

Template dispatch validation follows the same concept as session validation:

- one partner opens detailed validation,
- multiple partners open the “validation before posting” screen,
- the user can tap each partner to see details,
- the final action creates dispatch documents for selected partners.

### 4.5. Booking Sessions

Screens:

- `app/(tabs)/sessions/index.tsx`
- `app/(tabs)/sessions/[id]/index.tsx`
- `app/(tabs)/sessions/[id]/partner.tsx`
- `app/(tabs)/sessions/[id]/entry.tsx`
- `app/(tabs)/sessions/[id]/template.tsx`
- `app/(tabs)/sessions/[id]/items.tsx`
- `app/(tabs)/sessions/[id]/scan.tsx`

A session is an operational booking group made of partner entries.

The user can:

- add a partner,
- open a partner entry,
- add a template,
- add manual extra items,
- scan a paper dispatch form,
- validate the entire session,
- post the session.

### 4.6. Partner Entry

A partner entry is one partner-specific record inside a session.

It can contain:

- template items,
- extra items outside the document,
- scanned items,
- note,
- document date,
- draft/final mode.

If several different paper dispatch forms are scanned for the same partner within the same session, quantities can be added together. The same scan payload must not be saved twice, because that would duplicate an accidentally repeated scan. Example with different forms:

- first scan: Flour = 2,
- second scan: Flour = 2,
- partner entry should show Flour = 4.

### 4.7. Paper Dispatch Scanning

Screen:

- `app/(tabs)/sessions/[id]/scan.tsx`

Responsibilities:

- take a photo of the dispatch form,
- upload an image from gallery or files,
- keep a local unsaved scan draft,
- send the image to the backend,
- display analysis,
- allow manual correction of partner, date, items, and quantities,
- save confirmed items into the session entry.

The frontend does not run OCR and does not call Python directly.

## 5. Scan Flow Details

### 5.1. Upload

The mobile app sends a multipart request to:

`POST /api/v1/dispatch-booking-sessions/{id}/entries/scan/parse`

Parameters:

- `file`,
- optional `partnerId`,
- optional `templateId`,
- optional `documentDate`,
- optional `note`.

### 5.2. Image Analysis

The backend sends the image to the Python analyzer.

Python returns:

- `partnerNumber`,
- `partnerText`,
- `documentDate`,
- `quantities`,
- confidence values,
- warnings,
- image quality metrics.

### 5.3. Backend Mapping

The backend:

- checks session and user,
- resolves the partner,
- maps article codes to real items,
- if a template exists, maps lines to template documents,
- saves lines with `documentId` into `docPatches`,
- saves lines without `documentId` into `extraItems`.

### 5.4. Manual Correction

The user must be able to correct:

- partner,
- date,
- quantity,
- item,
- unknown or low-confidence lines.

### 5.5. Saving

Scan saving uses:

`PUT /api/v1/dispatch-booking-sessions/{id}/entries/scan`

The backend validates data again before saving. If an entry already exists for the same partner, scanned quantities are merged only when the scan payload was not already saved for that entry.

## 6. Validation

Validation checks the warehouse impact of a planned dispatch.

Terms:

- current stock: item quantity in the selected warehouse,
- planned quantity: quantity the user wants to dispatch,
- effectively available: available quantity after considering planned items,
- negative availability: planned dispatch exceeds available stock.

Validation is used:

- before posting a session,
- before creating dispatch documents from a template,
- when checking an individual document.

## 7. Posting

Session posting:

1. Backend loads all session entries.
2. It prepares an Oracle booking request for each entry.
3. It resolves documents and items.
4. It calls business logic.
5. It verifies the result.
6. It returns success or errors per partner.

After successful posting, the session is no longer editable.

## 8. Warehouse Rules

The selected warehouse must be respected across:

- home screen,
- item search,
- validation,
- scanning,
- posting.

If a warehouse has no positive stock, the app must not show items as available just because they exist in another warehouse.

## 9. Mobile UI Text Rules

Mobile UI should use Croatian business terminology.

Preferred examples:

- papirnata otpremnica,
- skeniraj otpremnicu,
- učitaj datoteku,
- validacija prije knjiženja,
- partner,
- skladište,
- stavke,
- količina,
- pouzdanost.

English words should not be shown to the user when a clear Croatian term exists.

## 10. Deployment and Startup

Typical order:

1. Start database and infrastructure from `infra`.
2. Start the Python analyzer.
3. Start the Quarkus backend.
4. Start the Expo mobile app.

Important checks:

- backend health endpoint,
- analyzer health endpoint,
- Oracle availability,
- valid JWT,
- correct analyzer URL,
- correct warehouse selection.

## 11. Testing Before Release

Minimum checks:

- backend build: `cd agape-api && mvn -DskipTests clean package`,
- frontend typecheck: `cd agape-mobile && npx tsc --noEmit`,
- Python compile: `cd dispatch-slip-analyzer && python -m py_compile app/*.py`,
- direct analyzer test with a sample image,
- manual mobile scanning flow,
- multi-partner validation,
- session posting,
- Oracle record verification after posting.

## 12. Maintenance Rules

When changing the system:

- frontend must not call Python directly,
- scan results must not be stored as separate OCR history,
- backend remains the validation source of truth,
- Oracle configuration must not be hardcoded,
- DTO changes must be synced with generated TypeScript types,
- user-facing mobile text should remain Croatian.

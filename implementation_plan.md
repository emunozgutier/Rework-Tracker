# Normalize PCB Board Numbers in Database

Currently, the `pcbs` table stores the full, formatted board number (e.g., `MAP-0001Q`) in the `board_number` column. This creates duplicated data, as the `MAP` portion is derived from the `project_key`.

## Goal
Store only the integer value (e.g., `1`) in `board_number`, and store the trailing CRC letter (e.g., `Q`) in a new `crc` column.

## User Review Required
> [!IMPORTANT]
> To prevent breaking the entire frontend (which relies on full names like `MAP-0001Q` for display, routing, and filtering), I plan to **reconstruct the full name dynamically in the backend** before sending it to the frontend.
> 
> The frontend will still send and receive `MAP-0001Q`, but the backend will parse it, store `1` in `board_number` and `Q` in `crc`, and reconstruct it on retrieval.
> 
> **Question:** Are you okay with the frontend remaining unaware of this change, using this as a pure database-level optimization/normalization? Or do you want the frontend UI to literally display "1" and "Q" separately across the whole app?

## Proposed Changes

### Database Schema (`src/store/database/db.js`)
- #### [MODIFY] `db.js`
  - Alter the `pcbs` table creation to include `crc TEXT`.
  - Add an `ALTER TABLE` migration to safely add `crc` to existing installations.

### Backend Logic (`src/store/database/server.js`)
- #### [MODIFY] `server.js`
  - **Migration logic**: On startup, run a one-time migration that updates existing `pcbs` rows, splitting `MAP-0001Q` into `board_number=1` and `crc=Q`.
  - **`GET /api/pcbs`**: Reconstruct the full string (`${project_key}-${padded_number}${crc}`) so the frontend receives what it expects.
  - **`POST /api/pcbs` & `PUT /api/pcbs`**: When the frontend sends `MAP-0001Q`, parse out the integer `1` and the `Q` to store in their respective columns.
  - **Reworks and Projects API**: Ensure that rework names and project-level numbering format updates correctly handle the new `board_number` format in SQL.

## Verification Plan
1. **Automated Validation**: Start the backend and verify that the migration succeeds without crashing. Check the SQLite DB to ensure `board_number` is `1` and `crc` is `Q`.
2. **Frontend Validation**: Create a new PCB through the UI, ensure it successfully parses and stores in SQL correctly, and renders properly in the frontend as `MAP-0001Q`.

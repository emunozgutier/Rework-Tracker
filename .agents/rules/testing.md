# Testing & Test Data Guidelines

## 1. Avoid Production/Dev Database Pollution
- Never insert dummy or test records into the main development database (`pcb_tracker.db`) or main upload folders (`pictures/`, `docs/`).
- Do not leave behind test projects, boards, reworks, or test files after completing a task.

## 2. Preferred Verification Methods
1. **Automated Vitest Tests (Highest Priority):**
   - For backend APIs, calculations, validators, and component rendering, write or run automated Vitest suites in `tests/`:
     ```bash
     npm run test:run
     # Or run a single test file:
     npx vitest run tests/<test-name>.test.ts
     ```
   - Vitest runs in `NODE_ENV=test` targeting `pcb_tracker_test.db` and automatically purges test records.

2. **Sandbox Environment (For Browser / E2E Verification):**
   - When manual verification, UI interaction, or browser testing is necessary, run the sandbox environment:
     ```bash
     npm run dev:sandbox
     ```
   - Sandbox runs on `pcb_tracker_sandbox.db` with uploads stored in `data/sandbox_uploads/`.
   - On first run, the sandbox automatically populates with demo data from `demoData.json`.

3. **Cleanup Protocol:**
   - If test records are created during manual verification or ad-hoc queries, tag them clearly (e.g. prefix names/descriptions with `[TEST]`).
   - Run the cleanup script before finishing your turn:
     ```bash
     npm run db:clean-test
     ```
   - To completely wipe and reset the sandbox at any time:
     ```bash
     npm run db:reset-sandbox
     ```

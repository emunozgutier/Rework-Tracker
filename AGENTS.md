# Agent Guidelines for PCB Rework Tracker

## Testing & Database Isolation Rules
- **No Test Data in Primary DB**: Never insert test records into the main `pcb_tracker.db` or the main upload folders (`pictures/`, `docs/`).
- **Use Vitest Suites**: For verifying backend endpoints, calculations, and UI components, always run or add Vitest integration tests (`npx vitest run tests/<file>.test.ts`). Vitest targets an isolated `pcb_tracker_test.db` and cleans up automatically.
- **Use Sandbox for Browser / Manual Testing**: When browser verification is required, start the app with `npm run dev:sandbox`. This isolates changes to `pcb_tracker_sandbox.db` and `data/sandbox_uploads/`.
- **Cleanup**: If any temporary records were added, run `npm run db:clean-test`. Reset the sandbox anytime with `npm run db:reset-sandbox`.

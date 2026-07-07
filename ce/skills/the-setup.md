# The Setup — dev environment for tax-assist

- Backend: `cd backend-ts && npm run dev` (Fastify, port 8001). Frontend: `cd frontend && npm run dev` (Vite 5173, proxies `/api`→8001).
- DB is PostgreSQL via `DATABASE_URL` in `backend-ts/.env`. **`npm test` wipes the shared dev DB.**
- Seed user: `npm run seed:test-user` → alex.carter@example.com / TestUser123!. Creates a NEW user id each run — re-seed + re-query the id after any `npm test`.
- Admin bootstrap: admin@localhost / changeme123.
- Scripts run TS directly via tsx: `npx tsx scripts/<x>.mjs` (see verifyFields.mjs, suggestStacks.mjs, checkFieldMappings.mjs).

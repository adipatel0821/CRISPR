# DecisionTwin — web

Next.js 16 (App Router) + TypeScript (strict) + Tailwind v4 + Radix primitives (shadcn-style components in
`src/components/ui`) + Recharts + lucide-react. Package manager: npm.

The UI never computes loan math. It formats the string decimals the backend sends and normalises what the
user types (for example `"4.75"` % → `"0.0475"`, by string manipulation in `src/lib/format.ts`).

## Run

```bash
npm ci
cp .env.example .env.local      # NEXT_PUBLIC_API_BASE, NEXT_PUBLIC_USE_FIXTURES
npm run dev                     # http://localhost:3000 (backend expected at NEXT_PUBLIC_API_BASE)
```

Fixture mode (no backend): `NEXT_PUBLIC_USE_FIXTURES=1 npm run dev`. The app serves `src/fixtures/*.json` and
labels every results page as fixture data.

## Scripts

| Script | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next core-web-vitals + typescript) |
| `npm run build` | production build |
| `npm test` | unit tests for formatters, %→fraction and provenance labels (`node --test`, Node ≥ 22.18) |
| `npm run gen:types` | regenerate `src/lib/contracts.ts` from `../contracts/schemas.json` |

Fixture data is generated offline and checked against the audited reference case and the Python contracts:

```bash
P:/Projects/DecisionTwin/backend/.venv/Scripts/python.exe scripts/build_fixtures.py     # asserts vs backend/fixtures/reference_case.json
P:/Projects/DecisionTwin/backend/.venv/Scripts/python.exe scripts/validate_fixtures.py  # DecisionReport.model_validate + claim/evidence integrity
```

## Layout

- `src/lib/api.ts` — typed client: bearer token, `ApiError` with recovery hints, 429/503 backoff (1/2/4 s), fixture switch
- `src/lib/contracts.ts` — generated types (fields with server defaults are marked present, as the backend serialises them)
- `src/lib/api-types.ts` — request bodies (fields with server defaults optional)
- `src/lib/fixture-backend.ts` — replays fixtures; records answers only
- `src/lib/provenance.ts` — chip wording; never says "verified" (A-42)
- `src/app/*` — `/` welcome, `/intake`, `/offer`, `/dashboard`, `/stress`, `/alternatives`, `/report`

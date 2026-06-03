# ReadyOn Time-Off Microservice

NestJS + SQLite implementation of the ReadyOn time-off take-home exercise.

The service manages employee time-off requests, keeps local balance projections aligned with HCM, preserves pending reservations, and includes a mutable mock HCM for regression-heavy tests.

## Architecture

- NestJS REST API
- SQLite persistence through Prisma
- Local balance projection per employee/location
- Pending reservation model to prevent double-spend
- Realtime HCM checks on request creation and approval
- Batch HCM sync that preserves local reservations
- Mock HCM endpoints for external balance changes and failure scenarios

Reviewer docs:

- Technical requirement document: [docs/TRD.md](docs/TRD.md)
- Test cases and coverage proof: [docs/TEST_CASES_AND_COVERAGE.md](docs/TEST_CASES_AND_COVERAGE.md)

## Setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run db:setup
npm run start:dev
```

`npm run db:setup` applies the committed SQLite migration directly. Prisma's schema engine can be environment-sensitive on some local machines, while the application itself still uses Prisma Client for all database access.

The service listens on `http://localhost:3000` by default.

## API Examples

Seed mock HCM:

```bash
curl -X POST http://localhost:3000/mock-hcm/balances \
  -H 'Content-Type: application/json' \
  -d '{"balances":[{"employeeId":"emp-1","locationId":"loc-1","balanceDays":10}]}'
```

Create a request:

```bash
curl -X POST http://localhost:3000/time-off-requests \
  -H 'Content-Type: application/json' \
  -d '{"employeeId":"emp-1","locationId":"loc-1","days":2}'
```

Read balance:

```bash
curl 'http://localhost:3000/balances/emp-1?locationId=loc-1'
```

Approve a request:

```bash
curl -X POST http://localhost:3000/time-off-requests/{id}/approve
```

Batch sync external HCM changes:

```bash
curl -X POST http://localhost:3000/sync/hcm-batch \
  -H 'Content-Type: application/json' \
  -d '{"balances":[{"employeeId":"emp-1","locationId":"loc-1","balanceDays":15}]}'
```

Pull batch sync from the configured mock HCM:

```bash
curl -X POST http://localhost:3000/sync/hcm-batch/pull
```

## Tests And Coverage

```bash
npm test
npm run test:e2e
npm run test:cov
```

Coverage target:

- Statements: 97.77%
- Branches: 100%
- Functions: 96.49%
- Lines: 97.61%

Latest local coverage proof from `npm run test:cov`:

```text
Test Suites: 6 passed, 6 total
Tests:       26 passed, 26 total
Statements:  97.77%
Branches:   100%
Functions:   96.49%
Lines:       97.61%
```

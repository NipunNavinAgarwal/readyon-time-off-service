# ReadyOn Take-Home Submission Guide

## What To Submit

Send the reviewer the public GitHub repository link:

```text
https://github.com/NipunNavinAgarwal/readyon-time-off-service
```

Include this short note in the submission message:

```text
Hi ReadyOn team,

I completed the Time-Off Microservice take-home exercise here:
https://github.com/NipunNavinAgarwal/readyon-time-off-service

Key deliverables:
- Technical Requirement Document: docs/TRD.md
- Test cases and coverage proof: docs/TEST_CASES_AND_COVERAGE.md
- Setup and API examples: README.md

The implementation uses NestJS, SQLite, Prisma, REST APIs, and a mutable mock HCM service. The test suite focuses on balance integrity, HCM drift, invalid dimensions, insufficient balance, idempotent approvals, batch sync, and defensive handling of unsafe HCM responses.
```

## Where Reviewers Should Look

- `README.md`: setup, API examples, architecture summary, and latest coverage numbers.
- `docs/TRD.md`: full technical requirement document with assumptions, alternatives, data model, sync strategy, and failure modes.
- `docs/TEST_CASES_AND_COVERAGE.md`: test case descriptions and coverage proof.
- `src/time-off-requests`: request lifecycle implementation and tests.
- `src/hcm`: mock HCM client and gateway.
- `src/sync`: batch sync endpoints and reconciliation behavior.

## Recommended Local Verification

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run db:setup
npm test
npm run test:cov
```

Expected proof:

```text
Test Suites: 6 passed, 6 total
Tests:       26 passed, 26 total
Statements:  97.77%
Branches:   100%
Functions:   96.49%
Lines:       97.61%
```


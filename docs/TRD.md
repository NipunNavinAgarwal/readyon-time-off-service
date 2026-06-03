# ReadyOn Time-Off Microservice TRD

## Problem Statement And Personas

ReadyOn needs a backend microservice that lets employees request time off while keeping balances aligned with an external Human Capital Management system such as Workday or SAP. HCM is the source of truth, but ReadyOn must still protect users from stale data, invalid employee/location combinations, and double-spending balances while requests are pending approval.

Personas:

- Employee: wants an accurate visible balance and immediate feedback when requesting time off.
- Manager: wants to approve only requests backed by valid, current balance data.

## Goals

- Manage the lifecycle of a time-off request from creation through approval or rejection.
- Maintain balances per employee per location.
- Treat HCM as source of truth while keeping a local projection for fast reads and pending reservations.
- Support realtime HCM checks and batch HCM reconciliation.
- Include mock HCM endpoints with realistic mutable state and failure modes.
- Provide rigorous automated tests and coverage proof.

## Non-Goals

- No frontend is included; this take-home is backend focused.
- No authentication or authorization is implemented; production would require employee and manager identity checks.
- No production queue or distributed lock is included; this implementation uses database transactions suitable for the SQLite take-home constraint.
- No payroll or calendar integration is included.

## System Architecture

The service is a modular NestJS application with SQLite persistence through Prisma.

- `balances`: owns local HCM balance projection, reservations, availability math, and audit events.
- `time-off-requests`: owns request lifecycle and state transitions.
- `hcm`: defines the HCM client abstraction and in-memory gateway used by the mock/test environment.
- `mock-hcm`: exposes test-only endpoints for mutable HCM behavior.
- `sync`: imports HCM batch balances and reconciles ReadyOn's local projection.

Read model:

```text
availableDays = hcmBalanceDays - reservedDays
```

ReadyOn never treats its projection as more authoritative than HCM. It uses the projection to protect against local double-spend and verifies request creation/approval against HCM.

## REST API Contract

### `GET /balances/:employeeId?locationId=loc-1`

Returns:

```json
{
  "employeeId": "emp-1",
  "locationId": "loc-1",
  "hcmBalanceDays": 10,
  "reservedDays": 2,
  "availableDays": 8,
  "lastSyncedAt": "2026-06-02T00:00:00.000Z"
}
```

### `POST /time-off-requests`

Request:

```json
{
  "employeeId": "emp-1",
  "locationId": "loc-1",
  "days": 2
}
```

Behavior:

- Fetch realtime HCM balance.
- Reject invalid employee/location combinations.
- Reject insufficient HCM balance.
- Upsert local HCM projection.
- Reserve days locally.
- Return a pending request.

### `GET /time-off-requests/:id`

Returns request details and status.

### `POST /time-off-requests/:id/approve`

Behavior:

- Valid only for pending requests.
- Sends a debit to HCM using an idempotency key.
- Defensively rejects unsafe HCM success responses such as negative remaining balance.
- Releases local reservation and decrements local HCM projection only after HCM success.
- Returns an approved request.

### `POST /time-off-requests/:id/reject`

Behavior:

- Valid only for pending requests.
- Releases local reservation.
- Returns a rejected request.

### `POST /sync/hcm-batch`

Request:

```json
{
  "balances": [
    { "employeeId": "emp-1", "locationId": "loc-1", "balanceDays": 15 }
  ]
}
```

Behavior:

- Updates local HCM balance projections.
- Preserves pending ReadyOn reservations.
- Recomputes availability from the updated projection.

This endpoint models a customer/HCM pushing the batch corpus into ReadyOn.

### `POST /sync/hcm-batch/pull`

Behavior:

- Pulls the current batch corpus from the configured HCM client.
- Applies the same reconciliation behavior as the pushed batch endpoint.
- Exists to exercise and document the pull-based integration path for HCMs where ReadyOn initiates sync.

### Mock HCM

- `POST /mock-hcm/reset`
- `POST /mock-hcm/balances`
- `GET /mock-hcm/balance?employeeId=emp-1&locationId=loc-1`
- `POST /mock-hcm/failure-mode`
- `GET /mock-hcm/batch`

These endpoints exist to support integration/e2e testing and simulate external HCM drift or failure.

## Data Model

### `Balance`

Stores one local projection per employee/location.

- `employeeId`
- `locationId`
- `hcmBalanceDays`
- `reservedDays`
- `lastSyncedAt`
- unique key: `employeeId + locationId`

### `TimeOffRequest`

Stores request lifecycle.

- `employeeId`
- `locationId`
- `days`
- `status`: `PENDING`, `APPROVED`, `REJECTED`, `FAILED`
- `idempotencyKey`
- `hcmTransactionId`
- timestamps

### `BalanceEvent`

Audit trail for operational clarity.

- `requestId`
- `employeeId`
- `locationId`
- `type`
- `delta`
- `metadata`
- timestamp

## Time-Off Request Lifecycle

```text
CREATE -> PENDING
PENDING -> APPROVED
PENDING -> REJECTED
PENDING -> FAILED
```

Create:

- HCM realtime balance must exist and be sufficient.
- ReadyOn updates its HCM projection.
- ReadyOn reserves the requested days.

Approve:

- ReadyOn files the debit against HCM.
- HCM success is validated defensively.
- ReadyOn releases the reservation and deducts the approved days from its projection.

Reject:

- ReadyOn releases the reservation.
- HCM is not mutated.

Failed:

- Used when HCM returns a response that ReadyOn cannot safely accept.
- A future retry endpoint or operations runbook would handle manual reconciliation for failed requests.

## HCM Realtime And Batch Sync Strategy

Realtime checks are used for request creation and approval. They provide immediate feedback and avoid relying solely on a stale local projection.

Batch sync is used for external changes, such as work anniversary grants or annual balance refreshes. Batch sync updates `hcmBalanceDays` but does not overwrite `reservedDays`, because those reservations represent ReadyOn requests that may not yet exist in HCM.

## Balance Integrity Rules

- Balances are scoped by employee and location.
- Requested days must be greater than zero.
- Local available balance must never be negative.
- Reserved days must never be negative.
- Approved HCM debit must be idempotent.
- HCM success with negative remaining balance is treated as unsafe and rejected.
- Pending reservations are preserved during batch sync.

## Failure Modes And Recovery

- Invalid employee/location: return `404`; do not create a request.
- Insufficient HCM balance: return `409`; do not reserve.
- Insufficient local available balance: return `409`; do not create another pending request.
- HCM debit failure during approval: keep request pending so approval can be retried.
- Unsafe HCM success: mark request failed and require manual reconciliation.
- Batch sync payload validation failure: reject payload with validation errors.

## Ambiguities And Chosen Assumptions

### When is balance deducted?

- Deduct on creation.
  - Pros: simple model.
  - Cons: employee loses balance before manager approval; reversal is harder.
- Reserve on creation, deduct on approval.
  - Pros: realistic workflow; prevents double-spend; approval remains meaningful.
  - Cons: requires reservation tracking.

Chosen: reserve on creation and debit HCM on approval.

### Should ReadyOn trust HCM errors completely?

- Rely only on HCM.
  - Pros: simpler.
  - Cons: assignment warns HCM behavior may not always be guaranteed.
- Validate locally and verify with HCM.
  - Pros: defensive and robust.
  - Cons: more logic and tests.

Chosen: local validation plus realtime HCM checks.

### How should batch sync interact with pending requests?

- Overwrite local balance directly.
  - Pros: easy to implement.
  - Cons: can erase reservations and allow overdraw.
- Update HCM projection while preserving reservations.
  - Pros: maintains balance integrity.
  - Cons: requires calculated availability.

Chosen: update `hcmBalanceDays`, preserve `reservedDays`.

### What dimensions define a balance?

- Employee only.
  - Pros: simpler.
  - Cons: contradicts the assignment.
- Employee plus location.
  - Pros: matches the assignment.
  - Cons: requires compound uniqueness.

Chosen: `employeeId + locationId`.

### REST or GraphQL?

- GraphQL.
  - Pros: flexible querying.
  - Cons: unnecessary complexity for the take-home.
- REST.
  - Pros: easy to review and test.
  - Cons: less query flexibility.

Chosen: REST.

### How realistic should mock HCM be?

- Static stubs.
  - Pros: fast.
  - Cons: weak regression value.
- Mutable mock endpoints with failure modes.
  - Pros: proves sync, insufficient-balance, and unsafe-success behavior.
  - Cons: more implementation.

Chosen: mutable in-app mock HCM endpoints.

## Alternatives Considered

### No Local Projection

Every balance read could go directly to HCM. That keeps ReadyOn thin, but it cannot represent pending manager approvals without repeatedly asking HCM about state HCM does not yet know. It also weakens the double-spend guard.

### Event-Only Ledger

A pure ledger could derive balances from events. This is auditable and scalable, but heavier than required for a short take-home. This implementation keeps a projection plus audit events, which gives reviewers both simplicity and operational visibility.

### Queue-Based HCM Writes

Approval could enqueue HCM writes and complete asynchronously. That is more resilient for production outages, but it weakens the manager's immediate confidence and makes the take-home harder to review. This implementation uses synchronous approval with retry-safe idempotency keys.

## Test Strategy And Coverage Proof

The suite is intentionally weighted toward balance integrity and HCM drift because those are the core risks in the assignment.

Covered scenarios:

- Availability calculation.
- Successful create/reserve/approve lifecycle.
- Rejection releases reservations.
- Invalid employee/location combinations.
- Insufficient HCM balance.
- HCM debit failures.
- Unsafe HCM success responses.
- Batch sync preserving pending reservations.
- Pull-based HCM batch sync.
- Concurrent requests preventing overdraw.
- Local pending reservations rejecting otherwise HCM-valid requests.
- Partial-day request reservation and approval.
- Repeated approval calls not double-debiting HCM.
- Request payload validation.
- Mock HCM reset behavior.
- Mock HCM endpoints supporting mutable state.

Coverage is generated with:

```bash
npm run test:cov
```

The target is at least 85% global statements, branches, functions, and lines.

Latest local proof:

- Test suites: 6 passed
- Tests: 26 passed
- Statements: 97.77%
- Branches: 100%
- Functions: 96.49%
- Lines: 97.61%

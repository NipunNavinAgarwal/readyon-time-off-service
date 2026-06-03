# Test Cases And Coverage Proof

## Coverage Summary

Latest local proof from `npm run test:cov`:

```text
Test Suites: 6 passed, 6 total
Tests:       26 passed, 26 total
Statements:  97.77%
Branches:   100%
Functions:   96.49%
Lines:       97.61%
```

The suite is intentionally focused on the assignment's highest-risk areas: balance integrity, HCM synchronization, HCM drift, idempotent approvals, defensive validation, and regression safety.

## Test Groups

### Balance Math And Guardrails

- Calculates available balance as `hcmBalanceDays - reservedDays`.
- Rounds decimal day math to avoid floating point noise.
- Rejects missing balance records.
- Rejects negative HCM balances.
- Rejects zero-day and invalid reservation attempts.
- Rejects releasing more days than are reserved.
- Rejects approved debits that would make local balance invalid.

### Mock HCM Behavior

- Seeds, reads, and returns batch balances.
- Rejects unknown employee/location combinations.
- Rejects negative seeded balances.
- Debits only once per idempotency key.
- Simulates HCM debit failure.
- Simulates unsafe HCM success with negative remaining balance.
- Resets balances, cached debits, and failure modes.

### Time-Off Request Lifecycle

- Rejects invalid employee/location combinations from HCM.
- Rejects insufficient HCM balance before creating a request.
- Rejects a second request when local pending reservations exhaust availability.
- Supports partial-day requests through reservation and approval.
- Validates request payloads and rejects unknown fields.
- Releases local reservations when a manager rejects a pending request.
- Handles missing request lookup.
- Prevents approving rejected requests.
- Prevents rejecting approved requests.
- Keeps a request pending when HCM debit fails during approval.
- Marks a request failed when HCM returns an unsafe success.

### End-To-End Business Flows

- Creates a request, reserves days, approves it, and debits HCM exactly once.
- Reconciles external HCM balance changes while preserving pending reservations.
- Prevents concurrent requests from overdrawing the same employee/location balance.

### Batch Sync

- Applies pushed HCM batch payloads through `POST /sync/hcm-batch`.
- Pulls the current HCM corpus through `POST /sync/hcm-batch/pull`.
- Preserves ReadyOn pending reservations during HCM balance refreshes.

### HTTP Error Mapping

- Maps domain errors to the correct HTTP responses:
  - `404` for missing resources or invalid dimensions.
  - `409` for balance conflicts.
  - `400` for invalid payloads.
- Preserves ordinary unexpected errors instead of hiding them behind incorrect domain responses.

## Why These Tests Matter

The tests prove that ReadyOn does not simply trust stale local state or optimistic HCM behavior. The system checks HCM, reserves locally, preserves pending reservations during batch sync, prevents overdraw, and uses idempotency keys so manager approval retries do not double-debit HCM.


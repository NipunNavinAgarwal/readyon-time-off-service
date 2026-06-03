import { DomainError } from '../common/errors';
import { InMemoryHcmGateway } from './in-memory-hcm.gateway';

describe('InMemoryHcmGateway', () => {
  let gateway: InMemoryHcmGateway;

  beforeEach(() => {
    gateway = new InMemoryHcmGateway();
  });

  it('seeds, reads, and returns batch balances', async () => {
    gateway.seed([{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 5 }]);

    await expect(gateway.getBalance('emp-1', 'loc-1')).resolves.toEqual({
      employeeId: 'emp-1',
      locationId: 'loc-1',
      balanceDays: 5,
    });
    await expect(gateway.getBatchBalances()).resolves.toEqual([
      { employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 5 },
    ]);
  });

  it('rejects negative seeded balances and unknown combinations', async () => {
    expect(() => gateway.setBalance('emp-1', 'loc-1', -1)).toThrow(DomainError);

    await expect(gateway.getBalance('missing', 'loc-1')).rejects.toThrow(DomainError);
    await expect(gateway.debitTimeOff('missing', 'loc-1', 1, 'key-1')).rejects.toThrow(DomainError);
  });

  it('debits once per idempotency key', async () => {
    gateway.seed([{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 5 }]);

    const first = await gateway.debitTimeOff('emp-1', 'loc-1', 2, 'same-key');
    const second = await gateway.debitTimeOff('emp-1', 'loc-1', 2, 'same-key');

    expect(second).toEqual(first);
    await expect(gateway.getBalance('emp-1', 'loc-1')).resolves.toMatchObject({ balanceDays: 3 });
  });

  it('supports configured failure and unsafe success modes', async () => {
    gateway.seed([{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 1 }]);

    await expect(gateway.debitTimeOff('emp-1', 'loc-1', 2, 'insufficient')).rejects.toThrow(DomainError);

    gateway.configureFailure({ failNextDebit: true });
    await expect(gateway.debitTimeOff('emp-1', 'loc-1', 1, 'fail-once')).rejects.toThrow(DomainError);

    gateway.configureFailure({ unsafeSuccessNextDebit: true });
    await expect(gateway.debitTimeOff('emp-1', 'loc-1', 2, 'unsafe')).resolves.toMatchObject({
      remainingBalanceDays: -1,
    });
  });

  it('resets balances, cached debits, and failure modes', async () => {
    gateway.seed([{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 5 }]);
    gateway.configureFailure({ failNextDebit: true });

    gateway.reset();

    await expect(gateway.getBatchBalances()).resolves.toEqual([]);
    gateway.seed([{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 2 }]);
    await expect(gateway.debitTimeOff('emp-1', 'loc-1', 1, 'after-reset')).resolves.toMatchObject({
      remainingBalanceDays: 1,
    });
  });
});

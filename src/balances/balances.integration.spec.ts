import { DomainError } from '../common/errors';
import { createTestApp } from '../../test/test-app';
import { BalancesService } from './balances.service';

describe('BalancesService integration', () => {
  it('rejects invalid balance inputs and missing records', async () => {
    const { app, prisma } = await createTestApp();
    const balances = app.get(BalancesService);

    await expect(balances.get('missing', 'loc-1')).rejects.toThrow(DomainError);
    await expect(balances.upsertFromHcm('emp-1', 'loc-1', -1)).rejects.toThrow(DomainError);
    await expect(balances.reserve('missing', 'loc-1', 1, 'request-1', prisma)).rejects.toThrow(DomainError);
    await expect(balances.reserve('missing', 'loc-1', 0, 'request-1', prisma)).rejects.toThrow(DomainError);
    await expect(balances.release('missing', 'loc-1', 1, 'request-1', prisma)).rejects.toThrow(DomainError);

    await app.close();
  });

  it('guards insufficient reservations and invalid approved debits', async () => {
    const { app, prisma } = await createTestApp();
    const balances = app.get(BalancesService);

    await balances.upsertFromHcm('emp-1', 'loc-1', 2);
    await expect(balances.reserve('emp-1', 'loc-1', 3, 'request-1', prisma)).rejects.toThrow(DomainError);
    await expect(balances.release('emp-1', 'loc-1', 1, 'request-1', prisma)).rejects.toThrow(DomainError);

    await balances.reserve('emp-1', 'loc-1', 2, 'request-1', prisma);
    await prisma.balance.update({
      where: { employeeId_locationId: { employeeId: 'emp-1', locationId: 'loc-1' } },
      data: { hcmBalanceDays: 1 },
    });

    await expect(balances.applyApprovedDebit('emp-1', 'loc-1', 2, 'request-1', prisma)).rejects.toThrow(DomainError);

    await app.close();
  });
});

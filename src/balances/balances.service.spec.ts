import { BalancesService } from './balances.service';

describe('BalancesService', () => {
  it('calculates available balance from HCM balance minus reservations', () => {
    const service = new BalancesService({} as never);

    expect(service.availableDays({ hcmBalanceDays: 10, reservedDays: 2.5 })).toBe(7.5);
  });

  it('rounds available balance to avoid floating point noise', () => {
    const service = new BalancesService({} as never);

    expect(service.availableDays({ hcmBalanceDays: 0.3, reservedDays: 0.2 })).toBe(0.1);
  });
});

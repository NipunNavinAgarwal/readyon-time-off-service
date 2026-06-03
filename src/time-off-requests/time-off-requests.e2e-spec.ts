import * as request from 'supertest';
import { createTestApp } from '../../test/test-app';

describe('TimeOffRequests e2e', () => {
  it('creates, reserves, approves, and debits HCM exactly once', async () => {
    const { app, hcm } = await createTestApp();
    hcm.seed([{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 10 }]);

    const created = await request(app.getHttpServer())
      .post('/time-off-requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-1', days: 2 })
      .expect(201);

    await request(app.getHttpServer())
      .get('/balances/emp-1?locationId=loc-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body.hcmBalanceDays).toBe(10);
        expect(body.reservedDays).toBe(2);
        expect(body.availableDays).toBe(8);
      });

    await request(app.getHttpServer()).post(`/time-off-requests/${created.body.id}/approve`).expect(201);
    await request(app.getHttpServer()).post(`/time-off-requests/${created.body.id}/approve`).expect(201);

    await request(app.getHttpServer())
      .get('/balances/emp-1?locationId=loc-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body.hcmBalanceDays).toBe(8);
        expect(body.reservedDays).toBe(0);
        expect(body.availableDays).toBe(8);
      });

    expect((await hcm.getBalance('emp-1', 'loc-1')).balanceDays).toBe(8);
    await app.close();
  });

  it('reconciles external HCM balance changes while preserving pending reservations', async () => {
    const { app, hcm } = await createTestApp();
    hcm.seed([{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 10 }]);

    await request(app.getHttpServer())
      .post('/time-off-requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-1', days: 3 })
      .expect(201);

    hcm.setBalance('emp-1', 'loc-1', 15);
    await request(app.getHttpServer())
      .post('/sync/hcm-batch')
      .send({ balances: [{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 15 }] })
      .expect(201);

    await request(app.getHttpServer())
      .get('/balances/emp-1?locationId=loc-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body.hcmBalanceDays).toBe(15);
        expect(body.reservedDays).toBe(3);
        expect(body.availableDays).toBe(12);
      });

    await app.close();
  });

  it('prevents overdraw across concurrent requests', async () => {
    const { app, hcm } = await createTestApp();
    hcm.seed([{ employeeId: 'emp-2', locationId: 'loc-1', balanceDays: 5 }]);

    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post('/time-off-requests').send({ employeeId: 'emp-2', locationId: 'loc-1', days: 4 }),
      request(app.getHttpServer()).post('/time-off-requests').send({ employeeId: 'emp-2', locationId: 'loc-1', days: 4 }),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    await request(app.getHttpServer())
      .get('/balances/emp-2?locationId=loc-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body.reservedDays).toBe(4);
        expect(body.availableDays).toBe(1);
      });
    await app.close();
  });
});

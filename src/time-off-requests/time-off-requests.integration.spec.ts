import * as request from 'supertest';
import { createTestApp } from '../../test/test-app';

describe('TimeOffRequests integration', () => {
  it('rejects invalid employee/location combinations from HCM', async () => {
    const { app } = await createTestApp();

    await request(app.getHttpServer())
      .post('/time-off-requests')
      .send({ employeeId: 'missing', locationId: 'loc-1', days: 1 })
      .expect(404);

    await app.close();
  });

  it('rejects insufficient HCM balance before reservation', async () => {
    const { app, hcm } = await createTestApp();
    hcm.seed([{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 1 }]);

    await request(app.getHttpServer())
      .post('/time-off-requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-1', days: 2 })
      .expect(409);

    await app.close();
  });

  it('rejects a second request when local pending reservations exhaust availability', async () => {
    const { app, hcm } = await createTestApp();
    hcm.seed([{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 5 }]);

    await request(app.getHttpServer())
      .post('/time-off-requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-1', days: 4 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/time-off-requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-1', days: 2 })
      .expect(409);

    await request(app.getHttpServer())
      .get('/balances/emp-1?locationId=loc-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body.hcmBalanceDays).toBe(5);
        expect(body.reservedDays).toBe(4);
        expect(body.availableDays).toBe(1);
      });

    await app.close();
  });

  it('supports partial-day requests through reserve and approval', async () => {
    const { app, hcm } = await createTestApp();
    hcm.seed([{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 3.5 }]);

    const created = await request(app.getHttpServer())
      .post('/time-off-requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-1', days: 0.5 })
      .expect(201);

    await request(app.getHttpServer())
      .get('/balances/emp-1?locationId=loc-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body.reservedDays).toBe(0.5);
        expect(body.availableDays).toBe(3);
      });

    await request(app.getHttpServer()).post(`/time-off-requests/${created.body.id}/approve`).expect(201);

    await request(app.getHttpServer())
      .get('/balances/emp-1?locationId=loc-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body.hcmBalanceDays).toBe(3);
        expect(body.reservedDays).toBe(0);
        expect(body.availableDays).toBe(3);
      });

    await app.close();
  });

  it('validates request payloads before reaching domain logic', async () => {
    const { app, hcm } = await createTestApp();
    hcm.seed([{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 5 }]);

    await request(app.getHttpServer())
      .post('/time-off-requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-1', days: 0 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/time-off-requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-1', days: 1, unexpected: true })
      .expect(400);

    await app.close();
  });

  it('releases reservation when manager rejects a pending request', async () => {
    const { app, hcm } = await createTestApp();
    hcm.seed([{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 6 }]);

    const created = await request(app.getHttpServer())
      .post('/time-off-requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-1', days: 2 })
      .expect(201);

    await request(app.getHttpServer()).post(`/time-off-requests/${created.body.id}/reject`).expect(201);

    await request(app.getHttpServer())
      .get('/balances/emp-1?locationId=loc-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body.reservedDays).toBe(0);
        expect(body.availableDays).toBe(6);
      });

    await app.close();
  });

  it('handles request lookup and terminal state conflicts', async () => {
    const { app, hcm } = await createTestApp();
    hcm.seed([
      { employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 6 },
      { employeeId: 'emp-2', locationId: 'loc-1', balanceDays: 6 },
    ]);

    await request(app.getHttpServer()).get('/time-off-requests/missing').expect(404);

    const rejected = await request(app.getHttpServer())
      .post('/time-off-requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-1', days: 2 })
      .expect(201);

    await request(app.getHttpServer()).post(`/time-off-requests/${rejected.body.id}/reject`).expect(201);
    await request(app.getHttpServer()).post(`/time-off-requests/${rejected.body.id}/reject`).expect(201);
    await request(app.getHttpServer()).post(`/time-off-requests/${rejected.body.id}/approve`).expect(409);

    const approved = await request(app.getHttpServer())
      .post('/time-off-requests')
      .send({ employeeId: 'emp-2', locationId: 'loc-1', days: 2 })
      .expect(201);

    await request(app.getHttpServer()).post(`/time-off-requests/${approved.body.id}/approve`).expect(201);
    await request(app.getHttpServer()).post(`/time-off-requests/${approved.body.id}/reject`).expect(409);

    await app.close();
  });

  it('keeps request non-approved when HCM debit fails', async () => {
    const { app, hcm } = await createTestApp();
    hcm.seed([{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 6 }]);

    const created = await request(app.getHttpServer())
      .post('/time-off-requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-1', days: 2 })
      .expect(201);

    hcm.configureFailure({ failNextDebit: true });
    await request(app.getHttpServer()).post(`/time-off-requests/${created.body.id}/approve`).expect(409);

    await request(app.getHttpServer())
      .get(`/time-off-requests/${created.body.id}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('PENDING');
      });

    await app.close();
  });

  it('marks request failed when HCM returns unsafe success', async () => {
    const { app, hcm } = await createTestApp();
    hcm.seed([{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 6 }]);

    const created = await request(app.getHttpServer())
      .post('/time-off-requests')
      .send({ employeeId: 'emp-1', locationId: 'loc-1', days: 2 })
      .expect(201);

    hcm.configureFailure({ unsafeSuccessNextDebit: true });
    await request(app.getHttpServer()).post(`/time-off-requests/${created.body.id}/approve`).expect(409);

    await request(app.getHttpServer())
      .get(`/time-off-requests/${created.body.id}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('FAILED');
      });

    await app.close();
  });

  it('exposes mutable mock HCM endpoints for test scenarios', async () => {
    const { app } = await createTestApp();

    await request(app.getHttpServer())
      .post('/mock-hcm/balances')
      .send({ balances: [{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 9 }] })
      .expect(201);

    await request(app.getHttpServer())
      .get('/mock-hcm/balance?employeeId=emp-1&locationId=loc-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body.balanceDays).toBe(9);
      });

    await app.close();
  });

  it('allows mock HCM state to be reset through the API', async () => {
    const { app } = await createTestApp();

    await request(app.getHttpServer())
      .post('/mock-hcm/balances')
      .send({ balances: [{ employeeId: 'emp-1', locationId: 'loc-1', balanceDays: 9 }] })
      .expect(201);

    await request(app.getHttpServer()).post('/mock-hcm/reset').send({}).expect(201);

    await request(app.getHttpServer())
      .get('/mock-hcm/balance?employeeId=emp-1&locationId=loc-1')
      .expect(404);

    await app.close();
  });
});

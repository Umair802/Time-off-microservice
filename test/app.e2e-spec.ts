import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from '../src/employees/employees.module';
import { LocationsModule } from '../src/locations/locations.module';
import { LeaveTypesModule } from '../src/leave-types/leave-types.module';
import { BalancesModule } from '../src/balances/balances.module';
import { TimeOffRequestsModule } from '../src/time-off-requests/time-off-requests.module';
import { Employee } from '../src/employees/employee.entity';
import { Location } from '../src/locations/location.entity';
import { LeaveType } from '../src/leave-types/leave-type.entity';
import { Balance } from '../src/balances/balance.entity';
import { TimeOffRequest } from '../src/time-off-requests/time-off-request.entity';
import { RequestStatusHistory } from '../src/time-off-requests/request-status-history.entity';

describe('Time-Off Request Lifecycle (e2e)', () => {
  let app: INestApplication;
  let employeeId: number;
  let locationId: number;
  let leaveTypeId: number;
  let balanceId: number;
  let requestId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [
            Employee,
            Location,
            LeaveType,
            Balance,
            TimeOffRequest,
            RequestStatusHistory,
          ],
          synchronize: true,
        }),
        EmployeesModule,
        LocationsModule,
        LeaveTypesModule,
        BalancesModule,
        TimeOffRequestsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Setup: Create Employee, Location, LeaveType, Balance', () => {
    it('should create an employee', async () => {
      const res = await request(app.getHttpServer())
        .post('/employees')
        .send({
          employeeId: 'EMP001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        })
        .expect(201);

      employeeId = res.body.id;
      expect(employeeId).toBeDefined();
    });

    it('should create a location', async () => {
      const res = await request(app.getHttpServer())
        .post('/locations')
        .send({
          locationId: 'LOC001',
          name: 'New York Office',
        })
        .expect(201);

      locationId = res.body.id;
      expect(locationId).toBeDefined();
    });

    it('should create a leave type', async () => {
      const res = await request(app.getHttpServer())
        .post('/leave-types')
        .send({
          code: 'VACATION',
          name: 'Vacation Leave',
        })
        .expect(201);

      leaveTypeId = res.body.id;
      expect(leaveTypeId).toBeDefined();
    });

    it('should create a balance with 20 days available', async () => {
      const res = await request(app.getHttpServer())
        .post('/balances')
        .send({
          employeeId,
          locationId,
          leaveTypeId,
          available: 20,
          used: 0,
          pending: 0,
        })
        .expect(201);

      balanceId = res.body.id;
      expect(balanceId).toBeDefined();
    });
  });

  describe('Happy Path: Create -> Approve -> Cancel', () => {
    it('should create a time-off request for 3 days', async () => {
      const res = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId,
          locationId,
          leaveTypeId,
          startDate: '2026-06-01',
          endDate: '2026-06-03',
          days: 3,
          reason: 'Family vacation',
        })
        .expect(201);

      requestId = res.body.id;
      expect(res.body.status).toBe('PENDING');
    });

    it('should have updated pending balance to 3', async () => {
      const res = await request(app.getHttpServer())
        .get(`/balances/${balanceId}`)
        .expect(200);

      expect(Number(res.body.pending)).toBe(3);
      expect(Number(res.body.available)).toBe(20);
    });

    it('should approve the request', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/time-off-requests/${requestId}/approve`)
        .send({ changedBy: 'manager1', reason: 'Looks good' })
        .expect(200);

      expect(res.body.status).toBe('APPROVED');
    });

    it('should cancel the approved request', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/time-off-requests/${requestId}/cancel`)
        .send({ changedBy: 'employee', reason: 'Plans changed' })
        .expect(200);

      expect(res.body.status).toBe('CANCELLED');
    });

    it('should have restored pending balance to 0', async () => {
      const res = await request(app.getHttpServer())
        .get(`/balances/${balanceId}`)
        .expect(200);

      expect(Number(res.body.pending)).toBe(0);
    });

    it('should have 3 history entries', async () => {
      const res = await request(app.getHttpServer())
        .get(`/time-off-requests/${requestId}/history`)
        .expect(200);

      expect(res.body.length).toBe(3); // PENDING, APPROVED, CANCELLED
    });
  });

  describe('Insufficient Balance', () => {
    it('should reject request exceeding available balance', async () => {
      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId,
          locationId,
          leaveTypeId,
          startDate: '2026-07-01',
          endDate: '2026-07-31',
          days: 25,
          reason: 'Long vacation',
        })
        .expect(400);
    });
  });

  describe('Invalid Transitions', () => {
    let newRequestId: number;

    it('should create a new request', async () => {
      const res = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId,
          locationId,
          leaveTypeId,
          startDate: '2026-08-01',
          endDate: '2026-08-02',
          days: 2,
        })
        .expect(201);

      newRequestId = res.body.id;
    });

    it('should reject the request', async () => {
      await request(app.getHttpServer())
        .patch(`/time-off-requests/${newRequestId}/reject`)
        .send({ changedBy: 'manager', reason: 'Not this time' })
        .expect(200);
    });

    it('should NOT allow approving a rejected request', async () => {
      await request(app.getHttpServer())
        .patch(`/time-off-requests/${newRequestId}/approve`)
        .send({ changedBy: 'manager' })
        .expect(400);
    });

    it('should NOT allow cancelling a rejected request', async () => {
      await request(app.getHttpServer())
        .patch(`/time-off-requests/${newRequestId}/cancel`)
        .send({ changedBy: 'employee' })
        .expect(400);
    });
  });

  describe('Validation', () => {
    it('should reject invalid date format', async () => {
      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId,
          locationId,
          leaveTypeId,
          startDate: 'not-a-date',
          endDate: '2026-08-02',
          days: 1,
        })
        .expect(400);
    });

    it('should reject negative days', async () => {
      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId,
          locationId,
          leaveTypeId,
          startDate: '2026-09-01',
          endDate: '2026-09-02',
          days: -1,
        })
        .expect(400);
    });

    it('should reject request with start > end date', async () => {
      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId,
          locationId,
          leaveTypeId,
          startDate: '2026-09-05',
          endDate: '2026-09-01',
          days: 1,
        })
        .expect(400);
    });
  });

  describe('CRUD Endpoints', () => {
    it('GET /employees should list employees', async () => {
      const res = await request(app.getHttpServer())
        .get('/employees')
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /locations should list locations', async () => {
      const res = await request(app.getHttpServer())
        .get('/locations')
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /leave-types should list leave types', async () => {
      const res = await request(app.getHttpServer())
        .get('/leave-types')
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /time-off-requests should list requests with filter', async () => {
      const res = await request(app.getHttpServer())
        .get(`/time-off-requests?employeeId=${employeeId}`)
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });
});

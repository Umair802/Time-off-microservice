import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TimeOffRequestsService } from './time-off-requests.service';
import { TimeOffRequest } from './time-off-request.entity';
import { RequestStatusHistory } from './request-status-history.entity';
import { Balance } from '../balances/balance.entity';
import { RequestStatus } from './enums/request-status.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TimeOffRequestsService', () => {
  let service: TimeOffRequestsService;
  let requestRepo: jest.Mocked<Repository<TimeOffRequest>>;
  let historyRepo: jest.Mocked<Repository<RequestStatusHistory>>;
  let balanceRepo: jest.Mocked<Repository<Balance>>;
  let dataSource: jest.Mocked<DataSource>;

  const mockBalance: Partial<Balance> = {
    id: 1,
    employeeId: 1,
    locationId: 1,
    leaveTypeId: 1,
    available: 20,
    used: 5,
    pending: 2,
    version: 1,
  };

  const mockRequest: Partial<TimeOffRequest> = {
    id: 1,
    employeeId: 1,
    locationId: 1,
    leaveTypeId: 1,
    startDate: '2026-05-01',
    endDate: '2026-05-02',
    days: 2,
    status: RequestStatus.PENDING,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeOffRequestsService,
        {
          provide: getRepositoryToken(TimeOffRequest),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RequestStatusHistory),
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Balance),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TimeOffRequestsService>(TimeOffRequestsService);
    requestRepo = module.get(getRepositoryToken(TimeOffRequest));
    historyRepo = module.get(getRepositoryToken(RequestStatusHistory));
    balanceRepo = module.get(getRepositoryToken(Balance));
    dataSource = module.get(DataSource);
  });

  describe('findOne', () => {
    it('should return a request when found', async () => {
      requestRepo.findOne.mockResolvedValue(mockRequest as TimeOffRequest);
      const result = await service.findOne(1);
      expect(result).toEqual(mockRequest);
    });

    it('should throw NotFoundException when not found', async () => {
      requestRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return filtered requests', async () => {
      requestRepo.find.mockResolvedValue([mockRequest as TimeOffRequest]);
      const result = await service.findAll({ employeeId: 1 });
      expect(result).toHaveLength(1);
      expect(requestRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { employeeId: 1 },
        }),
      );
    });

    it('should return requests filtered by status', async () => {
      requestRepo.find.mockResolvedValue([]);
      await service.findAll({ status: RequestStatus.APPROVED });
      expect(requestRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: RequestStatus.APPROVED },
        }),
      );
    });
  });

  describe('create', () => {
    it('should create a request when balance is sufficient', async () => {
      const mockManager = {
        findOne: jest.fn().mockResolvedValue({ ...mockBalance }),
        create: jest.fn().mockReturnValue({ ...mockRequest }),
        save: jest.fn().mockImplementation((entity, data) => ({ ...data, id: 1 })),
      };
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(mockManager),
      );

      const dto = {
        employeeId: 1,
        locationId: 1,
        leaveTypeId: 1,
        startDate: '2026-05-01',
        endDate: '2026-05-02',
        days: 2,
      };

      const result = await service.create(dto);
      expect(result).toBeDefined();
      expect(mockManager.findOne).toHaveBeenCalled();
    });

    it('should throw BadRequestException when balance is insufficient', async () => {
      const lowBalance = { ...mockBalance, available: 5, used: 4, pending: 1 };
      const mockManager = {
        findOne: jest.fn().mockResolvedValue(lowBalance),
        create: jest.fn(),
        save: jest.fn(),
      };
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(mockManager),
      );

      const dto = {
        employeeId: 1,
        locationId: 1,
        leaveTypeId: 1,
        startDate: '2026-05-01',
        endDate: '2026-05-03',
        days: 3,
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when no balance record exists', async () => {
      const mockManager = {
        findOne: jest.fn().mockResolvedValue(null),
      };
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(mockManager),
      );

      const dto = {
        employeeId: 99,
        locationId: 99,
        leaveTypeId: 99,
        startDate: '2026-05-01',
        endDate: '2026-05-02',
        days: 1,
      };

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when startDate > endDate', async () => {
      const dto = {
        employeeId: 1,
        locationId: 1,
        leaveTypeId: 1,
        startDate: '2026-05-05',
        endDate: '2026-05-01',
        days: 1,
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('should approve a PENDING request', async () => {
      const pendingRequest = { ...mockRequest, status: RequestStatus.PENDING };
      requestRepo.findOne.mockResolvedValue(pendingRequest as TimeOffRequest);
      requestRepo.save.mockResolvedValue({
        ...pendingRequest,
        status: RequestStatus.APPROVED,
      } as TimeOffRequest);
      historyRepo.create.mockReturnValue({} as any);
      historyRepo.save.mockResolvedValue({} as any);

      const result = await service.approve(1, { changedBy: 'manager' });
      expect(result.status).toBe(RequestStatus.APPROVED);
    });

    it('should throw when trying to approve a REJECTED request', async () => {
      const rejected = { ...mockRequest, status: RequestStatus.REJECTED };
      requestRepo.findOne.mockResolvedValue(rejected as TimeOffRequest);

      await expect(
        service.approve(1, { changedBy: 'manager' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getHistory', () => {
    it('should return history for a request', async () => {
      const mockHistory = [
        { id: 1, requestId: 1, fromStatus: null, toStatus: RequestStatus.PENDING },
        { id: 2, requestId: 1, fromStatus: RequestStatus.PENDING, toStatus: RequestStatus.APPROVED },
      ];
      historyRepo.find.mockResolvedValue(mockHistory as any);

      const result = await service.getHistory(1);
      expect(result).toHaveLength(2);
    });
  });
});

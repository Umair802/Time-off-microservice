import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BalancesService } from './balances.service';
import { Balance } from './balance.entity';
import { NotFoundException } from '@nestjs/common';

describe('BalancesService', () => {
  let service: BalancesService;
  let repo: jest.Mocked<Repository<Balance>>;

  const mockBalance: Partial<Balance> = {
    id: 1,
    employeeId: 1,
    locationId: 1,
    leaveTypeId: 1,
    available: 20,
    used: 5,
    pending: 3,
    version: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalancesService,
        {
          provide: getRepositoryToken(Balance),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BalancesService>(BalancesService);
    repo = module.get(getRepositoryToken(Balance));
  });

  describe('create', () => {
    it('should create a balance record', async () => {
      repo.create.mockReturnValue(mockBalance as Balance);
      repo.save.mockResolvedValue(mockBalance as Balance);

      const result = await service.create({
        employeeId: 1,
        locationId: 1,
        leaveTypeId: 1,
        available: 20,
      });
      expect(result.available).toBe(20);
    });
  });

  describe('findOne', () => {
    it('should return a balance by id', async () => {
      repo.findOne.mockResolvedValue(mockBalance as Balance);
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException for unknown id', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByComposite', () => {
    it('should find balance by employee+location+leaveType', async () => {
      repo.findOne.mockResolvedValue(mockBalance as Balance);
      const result = await service.findByComposite(1, 1, 1);
      expect(result).toEqual(mockBalance);
    });

    it('should return null when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.findByComposite(99, 99, 99);
      expect(result).toBeNull();
    });
  });

  describe('findAll with filters', () => {
    it('should filter by employeeId', async () => {
      repo.find.mockResolvedValue([mockBalance as Balance]);
      await service.findAll({ employeeId: 1 });
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ employeeId: 1 }),
        }),
      );
    });

    it('should return all when no filters', async () => {
      repo.find.mockResolvedValue([mockBalance as Balance]);
      await service.findAll();
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe('effectiveBalance getter', () => {
    it('should compute available - used - pending', () => {
      const balance = new Balance();
      balance.available = 20;
      balance.used = 5;
      balance.pending = 3;
      expect(balance.effectiveBalance).toBe(12);
    });

    it('should handle zero values', () => {
      const balance = new Balance();
      balance.available = 0;
      balance.used = 0;
      balance.pending = 0;
      expect(balance.effectiveBalance).toBe(0);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeesService } from './employees.service';
import { Employee } from './employee.entity';
import { NotFoundException } from '@nestjs/common';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let repo: jest.Mocked<Repository<Employee>>;

  const mockEmployee: Partial<Employee> = {
    id: 1,
    employeeId: 'EMP001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    isActive: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        {
          provide: getRepositoryToken(Employee),
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

    service = module.get<EmployeesService>(EmployeesService);
    repo = module.get(getRepositoryToken(Employee));
  });

  describe('create', () => {
    it('should create and return an employee', async () => {
      repo.create.mockReturnValue(mockEmployee as Employee);
      repo.save.mockResolvedValue(mockEmployee as Employee);

      const result = await service.create({
        employeeId: 'EMP001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });

      expect(result).toEqual(mockEmployee);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return an employee by id', async () => {
      repo.findOne.mockResolvedValue(mockEmployee as Employee);
      const result = await service.findOne(1);
      expect(result).toEqual(mockEmployee);
    });

    it('should throw NotFoundException for unknown id', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmployeeId', () => {
    it('should find by external employeeId', async () => {
      repo.findOne.mockResolvedValue(mockEmployee as Employee);
      const result = await service.findByEmployeeId('EMP001');
      expect(result.employeeId).toBe('EMP001');
    });

    it('should throw NotFoundException for unknown employeeId', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findByEmployeeId('UNKNOWN')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      repo.find.mockResolvedValue([mockEmployee as Employee]);
      const result = await service.findAll(10, 0);
      expect(result).toHaveLength(1);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 0 }),
      );
    });
  });

  describe('update', () => {
    it('should update an employee', async () => {
      repo.findOne.mockResolvedValue(mockEmployee as Employee);
      repo.save.mockResolvedValue({
        ...mockEmployee,
        firstName: 'Jane',
      } as Employee);

      const result = await service.update(1, { firstName: 'Jane' });
      expect(result.firstName).toBe('Jane');
    });
  });

  describe('remove', () => {
    it('should remove an employee', async () => {
      repo.findOne.mockResolvedValue(mockEmployee as Employee);
      repo.remove.mockResolvedValue(mockEmployee as Employee);

      await service.remove(1);
      expect(repo.remove).toHaveBeenCalledWith(mockEmployee);
    });
  });
});

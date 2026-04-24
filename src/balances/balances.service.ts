import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Balance } from './balance.entity';
import { CreateBalanceDto } from './dto/create-balance.dto';
import { UpdateBalanceDto } from './dto/update-balance.dto';
import { EmployeesService } from '../employees/employees.service';
import { LocationsService } from '../locations/locations.service';
import { LeaveTypesService } from '../leave-types/leave-types.service';

@Injectable()
export class BalancesService {
  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    private readonly employeesService: EmployeesService,
    private readonly locationsService: LocationsService,
    private readonly leaveTypesService: LeaveTypesService,
  ) {}

  async create(createBalanceDto: CreateBalanceDto): Promise<Balance> {
    const { employeeId, locationId, leaveTypeId } = createBalanceDto;

    // 1. Verify all components exist (will throw NotFoundException if they don't)
    await this.employeesService.findOne(employeeId);
    await this.locationsService.findOne(locationId);
    await this.leaveTypesService.findOne(leaveTypeId);

    // 2. Check for existing balance for this combination
    const existing = await this.findByComposite(employeeId, locationId, leaveTypeId);
    if (existing) {
      throw new ConflictException(
        'Balance already exists for this combination of employee, location, and leave type',
      );
    }

    const balance = this.balanceRepository.create(createBalanceDto);
    return this.balanceRepository.save(balance);
  }

  async findAll(
    filters?: { employeeId?: number; locationId?: number; leaveTypeId?: number },
    limit = 20,
    offset = 0,
  ): Promise<Balance[]> {
    const where: any = {};
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.locationId) where.locationId = filters.locationId;
    if (filters?.leaveTypeId) where.leaveTypeId = filters.leaveTypeId;

    return this.balanceRepository.find({
      where,
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Balance> {
    const balance = await this.balanceRepository.findOne({ where: { id } });
    if (!balance) {
      throw new NotFoundException(`Balance with ID ${id} not found`);
    }
    return balance;
  }

  async findByComposite(
    employeeId: number,
    locationId: number,
    leaveTypeId: number,
  ): Promise<Balance | null> {
    return this.balanceRepository.findOne({
      where: { employeeId, locationId, leaveTypeId },
    });
  }

  async update(
    id: number,
    updateBalanceDto: UpdateBalanceDto,
  ): Promise<Balance> {
    const balance = await this.findOne(id);
    Object.assign(balance, updateBalanceDto);
    return this.balanceRepository.save(balance);
  }

  async remove(id: number): Promise<void> {
    const balance = await this.findOne(id);
    await this.balanceRepository.remove(balance);
  }
}

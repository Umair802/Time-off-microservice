import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveType } from './leave-type.entity';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';

@Injectable()
export class LeaveTypesService {
  constructor(
    @InjectRepository(LeaveType)
    private readonly leaveTypeRepository: Repository<LeaveType>,
  ) {}

  async create(createLeaveTypeDto: CreateLeaveTypeDto): Promise<LeaveType> {
    const existing = await this.leaveTypeRepository.findOne({
      where: { code: createLeaveTypeDto.code },
    });
    if (existing) {
      throw new ConflictException(
        `LeaveType with code ${createLeaveTypeDto.code} already exists`,
      );
    }
    const leaveType = this.leaveTypeRepository.create(createLeaveTypeDto);
    return this.leaveTypeRepository.save(leaveType);
  }

  async findAll(limit = 20, offset = 0): Promise<LeaveType[]> {
    return this.leaveTypeRepository.find({
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<LeaveType> {
    const leaveType = await this.leaveTypeRepository.findOne({
      where: { id },
    });
    if (!leaveType) {
      throw new NotFoundException(`LeaveType with ID ${id} not found`);
    }
    return leaveType;
  }

  async findByCode(code: string): Promise<LeaveType> {
    const leaveType = await this.leaveTypeRepository.findOne({
      where: { code },
    });
    if (!leaveType) {
      throw new NotFoundException(`LeaveType with code ${code} not found`);
    }
    return leaveType;
  }

  async update(
    id: number,
    updateLeaveTypeDto: UpdateLeaveTypeDto,
  ): Promise<LeaveType> {
    const leaveType = await this.findOne(id);
    Object.assign(leaveType, updateLeaveTypeDto);
    return this.leaveTypeRepository.save(leaveType);
  }

  async remove(id: number): Promise<void> {
    const leaveType = await this.findOne(id);
    await this.leaveTypeRepository.remove(leaveType);
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TimeOffRequest } from './time-off-request.entity';
import { RequestStatusHistory } from './request-status-history.entity';
import { Balance } from '../balances/balance.entity';
import { CreateTimeOffRequestDto } from './dto/create-time-off-request.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import {
  RequestStatus,
  isValidTransition,
} from './enums/request-status.enum';

@Injectable()
export class TimeOffRequestsService {
  constructor(
    @InjectRepository(TimeOffRequest)
    private readonly requestRepository: Repository<TimeOffRequest>,
    @InjectRepository(RequestStatusHistory)
    private readonly historyRepository: Repository<RequestStatusHistory>,
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateTimeOffRequestDto): Promise<TimeOffRequest> {
    // Validate dates
    if (dto.startDate > dto.endDate) {
      throw new BadRequestException('Start date must be before or equal to end date');
    }

    // Use a transaction to check balance and create request atomically
    return this.dataSource.transaction(async (manager) => {
      // Find the balance record
      const balance = await manager.findOne(Balance, {
        where: {
          employeeId: dto.employeeId,
          locationId: dto.locationId,
          leaveTypeId: dto.leaveTypeId,
        },
      });

      if (!balance) {
        throw new NotFoundException(
          `No balance found for employee ${dto.employeeId}, location ${dto.locationId}, leave type ${dto.leaveTypeId}`,
        );
      }

      // Defensive balance check
      const effectiveBalance =
        Number(balance.available) - Number(balance.used) - Number(balance.pending);
      if (dto.days > effectiveBalance) {
        throw new BadRequestException(
          `Insufficient balance. Requested: ${dto.days}, Available: ${effectiveBalance}`,
        );
      }

      // Create the request
      const request = manager.create(TimeOffRequest, {
        ...dto,
        status: RequestStatus.PENDING,
      });
      const savedRequest = await manager.save(TimeOffRequest, request);

      // Update pending balance
      balance.pending = Number(balance.pending) + Number(dto.days);
      await manager.save(Balance, balance);

      // Record history
      const history = manager.create(RequestStatusHistory, {
        requestId: savedRequest.id,
        fromStatus: null,
        toStatus: RequestStatus.PENDING,
        changedBy: 'employee',
        reason: 'Request created',
      });
      await manager.save(RequestStatusHistory, history);

      return savedRequest;
    });
  }

  async findAll(filters?: {
    employeeId?: number;
    status?: RequestStatus;
    limit?: number;
    offset?: number;
  }): Promise<TimeOffRequest[]> {
    const where: any = {};
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.status) where.status = filters.status;

    return this.requestRepository.find({
      where,
      take: filters?.limit || 20,
      skip: filters?.offset || 0,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<TimeOffRequest> {
    const request = await this.requestRepository.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException(`Time-off request with ID ${id} not found`);
    }
    return request;
  }

  async getHistory(requestId: number): Promise<RequestStatusHistory[]> {
    return this.historyRepository.find({
      where: { requestId },
      order: { timestamp: 'ASC' },
    });
  }

  async approve(
    id: number,
    dto: UpdateRequestStatusDto,
  ): Promise<TimeOffRequest> {
    return this.transitionStatus(
      id,
      RequestStatus.APPROVED,
      dto.changedBy || 'manager',
      dto.reason,
      dto.managerNotes,
    );
  }

  async reject(
    id: number,
    dto: UpdateRequestStatusDto,
  ): Promise<TimeOffRequest> {
    return this.dataSource.transaction(async (manager) => {
      const request = await manager.findOne(TimeOffRequest, { where: { id } });
      if (!request) {
        throw new NotFoundException(`Time-off request with ID ${id} not found`);
      }

      if (!isValidTransition(request.status, RequestStatus.REJECTED)) {
        throw new BadRequestException(
          `Cannot transition from ${request.status} to REJECTED`,
        );
      }

      // Release pending balance
      const balance = await manager.findOne(Balance, {
        where: {
          employeeId: request.employeeId,
          locationId: request.locationId,
          leaveTypeId: request.leaveTypeId,
        },
      });
      if (balance) {
        balance.pending = Math.max(
          0,
          Number(balance.pending) - Number(request.days),
        );
        await manager.save(Balance, balance);
      }

      const previousStatus = request.status;
      request.status = RequestStatus.REJECTED;
      if (dto.managerNotes) request.managerNotes = dto.managerNotes;
      const saved = await manager.save(TimeOffRequest, request);

      // Record history
      await manager.save(RequestStatusHistory, {
        requestId: id,
        fromStatus: previousStatus,
        toStatus: RequestStatus.REJECTED,
        changedBy: dto.changedBy || 'manager',
        reason: dto.reason || 'Request rejected',
      });

      return saved;
    });
  }

  async cancel(
    id: number,
    dto: UpdateRequestStatusDto,
  ): Promise<TimeOffRequest> {
    return this.dataSource.transaction(async (manager) => {
      const request = await manager.findOne(TimeOffRequest, { where: { id } });
      if (!request) {
        throw new NotFoundException(`Time-off request with ID ${id} not found`);
      }

      if (!isValidTransition(request.status, RequestStatus.CANCELLED)) {
        throw new BadRequestException(
          `Cannot cancel a request in ${request.status} status`,
        );
      }

      const balance = await manager.findOne(Balance, {
        where: {
          employeeId: request.employeeId,
          locationId: request.locationId,
          leaveTypeId: request.leaveTypeId,
        },
      });

      if (balance) {
        if (
          request.status === RequestStatus.CONFIRMED ||
          request.status === RequestStatus.SUBMITTED_TO_HCM
        ) {
          // Was already counted as used, reverse it
          balance.used = Math.max(
            0,
            Number(balance.used) - Number(request.days),
          );
        } else {
          // Was still pending
          balance.pending = Math.max(
            0,
            Number(balance.pending) - Number(request.days),
          );
        }
        await manager.save(Balance, balance);
      }

      const previousStatus = request.status;
      request.status = RequestStatus.CANCELLED;
      const saved = await manager.save(TimeOffRequest, request);

      await manager.save(RequestStatusHistory, {
        requestId: id,
        fromStatus: previousStatus,
        toStatus: RequestStatus.CANCELLED,
        changedBy: dto.changedBy || 'system',
        reason: dto.reason || 'Request cancelled',
      });

      return saved;
    });
  }

  async submitToHcm(id: number): Promise<TimeOffRequest> {
    return this.dataSource.transaction(async (manager) => {
      const request = await manager.findOne(TimeOffRequest, { where: { id } });
      if (!request) {
        throw new NotFoundException(`Time-off request with ID ${id} not found`);
      }

      if (!isValidTransition(request.status, RequestStatus.SUBMITTED_TO_HCM)) {
        throw new BadRequestException(
          `Cannot submit to HCM from ${request.status} status`,
        );
      }

      // Re-validate balance defensively before submission
      const balance = await manager.findOne(Balance, {
        where: {
          employeeId: request.employeeId,
          locationId: request.locationId,
          leaveTypeId: request.leaveTypeId,
        },
      });

      if (balance) {
        const effectiveBalance =
          Number(balance.available) - Number(balance.used);
        if (Number(request.days) > effectiveBalance) {
          throw new ConflictException(
            `Balance changed since approval. Available: ${effectiveBalance}, Requested: ${request.days}`,
          );
        }

        // Move from pending to used
        balance.pending = Math.max(
          0,
          Number(balance.pending) - Number(request.days),
        );
        balance.used = Number(balance.used) + Number(request.days);
        await manager.save(Balance, balance);
      }

      const previousStatus = request.status;
      request.status = RequestStatus.SUBMITTED_TO_HCM;
      const saved = await manager.save(TimeOffRequest, request);

      await manager.save(RequestStatusHistory, {
        requestId: id,
        fromStatus: previousStatus,
        toStatus: RequestStatus.SUBMITTED_TO_HCM,
        changedBy: 'system',
        reason: 'Submitted to HCM',
      });

      return saved;
    });
  }

  async confirmFromHcm(
    id: number,
    hcmReferenceId: string,
  ): Promise<TimeOffRequest> {
    return this.dataSource.transaction(async (manager) => {
      const request = await manager.findOne(TimeOffRequest, { where: { id } });
      if (!request) {
        throw new NotFoundException(`Time-off request with ID ${id} not found`);
      }

      if (!isValidTransition(request.status, RequestStatus.CONFIRMED)) {
        throw new BadRequestException(
          `Cannot confirm from ${request.status} status`,
        );
      }

      const previousStatus = request.status;
      request.status = RequestStatus.CONFIRMED;
      request.hcmReferenceId = hcmReferenceId;
      const saved = await manager.save(TimeOffRequest, request);

      await manager.save(RequestStatusHistory, {
        requestId: id,
        fromStatus: previousStatus,
        toStatus: RequestStatus.CONFIRMED,
        changedBy: 'hcm',
        reason: `Confirmed by HCM. Reference: ${hcmReferenceId}`,
      });

      return saved;
    });
  }

  async hcmReject(id: number, reason: string): Promise<TimeOffRequest> {
    return this.dataSource.transaction(async (manager) => {
      const request = await manager.findOne(TimeOffRequest, { where: { id } });
      if (!request) {
        throw new NotFoundException(`Time-off request with ID ${id} not found`);
      }

      if (!isValidTransition(request.status, RequestStatus.HCM_REJECTED)) {
        throw new BadRequestException(
          `Cannot HCM reject from ${request.status} status`,
        );
      }

      // Reverse the used balance back to pending
      const balance = await manager.findOne(Balance, {
        where: {
          employeeId: request.employeeId,
          locationId: request.locationId,
          leaveTypeId: request.leaveTypeId,
        },
      });

      if (balance) {
        balance.used = Math.max(
          0,
          Number(balance.used) - Number(request.days),
        );
        balance.pending = Number(balance.pending) + Number(request.days);
        await manager.save(Balance, balance);
      }

      const previousStatus = request.status;
      request.status = RequestStatus.HCM_REJECTED;
      const saved = await manager.save(TimeOffRequest, request);

      await manager.save(RequestStatusHistory, {
        requestId: id,
        fromStatus: previousStatus,
        toStatus: RequestStatus.HCM_REJECTED,
        changedBy: 'hcm',
        reason: reason || 'Rejected by HCM',
      });

      return saved;
    });
  }

  private async transitionStatus(
    id: number,
    newStatus: RequestStatus,
    changedBy: string,
    reason?: string,
    managerNotes?: string,
  ): Promise<TimeOffRequest> {
    const request = await this.findOne(id);

    if (!isValidTransition(request.status, newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${request.status} to ${newStatus}`,
      );
    }

    const previousStatus = request.status;
    request.status = newStatus;
    if (managerNotes) request.managerNotes = managerNotes;
    const saved = await this.requestRepository.save(request);

    const history = this.historyRepository.create({
      requestId: id,
      fromStatus: previousStatus,
      toStatus: newStatus,
      changedBy,
      reason,
    });
    await this.historyRepository.save(history);

    return saved;
  }
}

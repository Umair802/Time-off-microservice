import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Balance } from '../balances/balance.entity';
import { Employee } from '../employees/employee.entity';
import { Location } from '../locations/location.entity';
import { LeaveType } from '../leave-types/leave-type.entity';
import { TimeOffRequest } from '../time-off-requests/time-off-request.entity';
import { RequestStatus } from '../time-off-requests/enums/request-status.enum';
import { SyncLog } from './sync-log.entity';
import { HcmService } from '../hcm/hcm.service';
import { BatchBalanceItemDto } from './dto/batch-sync.dto';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    @InjectRepository(LeaveType)
    private readonly leaveTypeRepository: Repository<LeaveType>,
    @InjectRepository(TimeOffRequest)
    private readonly requestRepository: Repository<TimeOffRequest>,
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>,
    private readonly hcmService: HcmService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Sync a single employee's balance from HCM real-time API.
   */
  async syncSingleBalance(
    employeeExternalId: string,
    locationExternalId: string,
    leaveTypeCode: string,
  ): Promise<{ updated: boolean; balance: Balance | null }> {
    try {
      const hcmBalance = await this.hcmService.getBalance(
        employeeExternalId,
        locationExternalId,
        leaveTypeCode,
      );

      return await this.upsertBalance(
        employeeExternalId,
        locationExternalId,
        leaveTypeCode,
        hcmBalance.available,
        hcmBalance.used,
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync balance for employee ${employeeExternalId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Process a batch sync payload from HCM.
   */
  async processBatchSync(
    items: BatchBalanceItemDto[],
  ): Promise<{ processed: number; errors: number; details: string[] }> {
    let processed = 0;
    let errors = 0;
    const details: string[] = [];

    for (const item of items) {
      try {
        await this.upsertBalance(
          item.employeeId,
          item.locationId,
          item.leaveTypeCode,
          item.available,
          item.used,
        );
        processed++;
      } catch (error) {
        errors++;
        const msg = `Failed to sync ${item.employeeId}/${item.locationId}/${item.leaveTypeCode}: ${(error as Error).message}`;
        details.push(msg);
        this.logger.warn(msg);
      }
    }

    return { processed, errors, details };
  }

  /**
   * Reconcile all local balances against HCM.
   * Fetches each balance from HCM and logs/resolves discrepancies.
   */
  async reconcile(): Promise<{
    checked: number;
    discrepancies: number;
    resolved: number;
  }> {
    const balances = await this.balanceRepository.find({
      relations: ['employee', 'location', 'leaveType'],
    });

    let checked = 0;
    let discrepancies = 0;
    let resolved = 0;

    for (const balance of balances) {
      checked++;
      try {
        const hcmBalance = await this.hcmService.getBalance(
          balance.employee.employeeId,
          balance.location.locationId,
          balance.leaveType.code,
        );

        const localAvailable = Number(balance.available);
        const localUsed = Number(balance.used);
        const hcmAvailable = Number(hcmBalance.available);
        const hcmUsed = Number(hcmBalance.used);

        if (localAvailable !== hcmAvailable || localUsed !== hcmUsed) {
          discrepancies++;

          // Log the discrepancy
          await this.syncLogRepository.save({
            employeeExternalId: balance.employee.employeeId,
            locationExternalId: balance.location.locationId,
            leaveTypeCode: balance.leaveType.code,
            localAvailable,
            localUsed,
            hcmAvailable,
            hcmUsed,
            action: 'RECONCILE_DISCREPANCY',
            details: `Local(avail=${localAvailable},used=${localUsed}) vs HCM(avail=${hcmAvailable},used=${hcmUsed})`,
          });

          // HCM wins — update local
          balance.available = hcmAvailable;
          balance.used = hcmUsed;
          balance.lastSyncedAt = new Date();
          await this.balanceRepository.save(balance);

          // Re-evaluate pending requests
          await this.reevaluatePendingRequests(balance);

          resolved++;
        }
      } catch (error) {
        this.logger.warn(
          `Reconciliation failed for balance ${balance.id}: ${(error as Error).message}`,
        );
      }
    }

    return { checked, discrepancies, resolved };
  }

  /**
   * Get sync logs with optional filtering.
   */
  async getSyncLogs(limit = 50, offset = 0): Promise<SyncLog[]> {
    return this.syncLogRepository.find({
      take: limit,
      skip: offset,
      order: { timestamp: 'DESC' },
    });
  }

  /**
   * Upsert a balance record from HCM data.
   * Creates employee/location/leaveType if they don't exist yet.
   */
  private async upsertBalance(
    employeeExternalId: string,
    locationExternalId: string,
    leaveTypeCode: string,
    hcmAvailable: number,
    hcmUsed: number,
  ): Promise<{ updated: boolean; balance: Balance | null }> {
    return this.dataSource.transaction(async (manager) => {
      // Find or skip if employee/location/leaveType don't exist
      const employee = await manager.findOne(Employee, {
        where: { employeeId: employeeExternalId },
      });
      if (!employee) {
        this.logger.warn(
          `Employee ${employeeExternalId} not found locally, skipping sync`,
        );
        return { updated: false, balance: null };
      }

      const location = await manager.findOne(Location, {
        where: { locationId: locationExternalId },
      });
      if (!location) {
        this.logger.warn(
          `Location ${locationExternalId} not found locally, skipping sync`,
        );
        return { updated: false, balance: null };
      }

      const leaveType = await manager.findOne(LeaveType, {
        where: { code: leaveTypeCode },
      });
      if (!leaveType) {
        this.logger.warn(
          `LeaveType ${leaveTypeCode} not found locally, skipping sync`,
        );
        return { updated: false, balance: null };
      }

      // Find or create balance
      let balance = await manager.findOne(Balance, {
        where: {
          employeeId: employee.id,
          locationId: location.id,
          leaveTypeId: leaveType.id,
        },
      });

      const wasNew = !balance;
      const oldAvailable = balance ? Number(balance.available) : 0;
      const oldUsed = balance ? Number(balance.used) : 0;

      if (!balance) {
        balance = manager.create(Balance, {
          employeeId: employee.id,
          locationId: location.id,
          leaveTypeId: leaveType.id,
          available: hcmAvailable,
          used: hcmUsed,
          pending: 0,
          lastSyncedAt: new Date(),
        });
      } else {
        balance.available = hcmAvailable;
        balance.used = hcmUsed;
        balance.lastSyncedAt = new Date();
      }

      const savedBalance = await manager.save(Balance, balance);

      // Log the sync
      await manager.save(SyncLog, {
        employeeExternalId,
        locationExternalId,
        leaveTypeCode,
        localAvailable: oldAvailable,
        localUsed: oldUsed,
        hcmAvailable,
        hcmUsed,
        action: wasNew ? 'SYNC_CREATE' : 'SYNC_UPDATE',
        details: wasNew
          ? 'New balance created from HCM'
          : `Updated from (${oldAvailable},${oldUsed}) to (${hcmAvailable},${hcmUsed})`,
      });

      // Re-evaluate pending requests if balance changed
      if (!wasNew && (oldAvailable !== hcmAvailable || oldUsed !== hcmUsed)) {
        await this.reevaluatePendingRequestsInTransaction(
          manager,
          savedBalance,
        );
      }

      return { updated: true, balance: savedBalance };
    });
  }

  /**
   * After a balance sync, check if pending requests still have sufficient balance.
   * Flag any that now exceed the available balance.
   */
  private async reevaluatePendingRequests(balance: Balance): Promise<void> {
    const pendingRequests = await this.requestRepository.find({
      where: {
        employeeId: balance.employeeId,
        locationId: balance.locationId,
        leaveTypeId: balance.leaveTypeId,
        status: RequestStatus.PENDING,
      },
      order: { createdAt: 'ASC' },
    });

    if (pendingRequests.length === 0) return;

    const effectiveBalance =
      Number(balance.available) - Number(balance.used);
    let runningPending = 0;

    for (const request of pendingRequests) {
      runningPending += Number(request.days);
      if (runningPending > effectiveBalance) {
        this.logger.warn(
          `Request ${request.id} may exceed balance after sync. ` +
            `Running pending: ${runningPending}, Effective: ${effectiveBalance}`,
        );
      }
    }

    // Update the balance's pending total
    balance.pending = runningPending;
    await this.balanceRepository.save(balance);
  }

  private async reevaluatePendingRequestsInTransaction(
    manager: any,
    balance: Balance,
  ): Promise<void> {
    const pendingRequests = await manager.find(TimeOffRequest, {
      where: {
        employeeId: balance.employeeId,
        locationId: balance.locationId,
        leaveTypeId: balance.leaveTypeId,
        status: RequestStatus.PENDING,
      },
      order: { createdAt: 'ASC' },
    });

    if (pendingRequests.length === 0) return;

    const effectiveBalance =
      Number(balance.available) - Number(balance.used);
    let runningPending = 0;

    for (const request of pendingRequests) {
      runningPending += Number(request.days);
      if (runningPending > effectiveBalance) {
        this.logger.warn(
          `Request ${request.id} may exceed balance after sync. ` +
            `Running pending: ${runningPending}, Effective: ${effectiveBalance}`,
        );
      }
    }

    balance.pending = runningPending;
    await manager.save(Balance, balance);
  }
}

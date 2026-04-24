import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { BatchSyncDto } from './dto/batch-sync.dto';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * Webhook endpoint for HCM to push batch balance data.
   */
  @Post('batch')
  processBatchSync(@Body() batchSyncDto: BatchSyncDto) {
    return this.syncService.processBatchSync(batchSyncDto.balances);
  }

  /**
   * Trigger a single-employee balance sync from HCM.
   */
  @Post('employee/:employeeId/:locationId/:leaveTypeCode')
  syncSingle(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
    @Param('leaveTypeCode') leaveTypeCode: string,
  ) {
    return this.syncService.syncSingleBalance(
      employeeId,
      locationId,
      leaveTypeCode,
    );
  }

  /**
   * Trigger full reconciliation of all balances against HCM.
   */
  @Post('reconcile')
  reconcile() {
    return this.syncService.reconcile();
  }

  /**
   * Get sync logs for audit trail.
   */
  @Get('logs')
  getSyncLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.syncService.getSyncLogs(
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}

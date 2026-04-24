import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffRequest } from './time-off-request.entity';
import { RequestStatusHistory } from './request-status-history.entity';
import { Balance } from '../balances/balance.entity';
import { TimeOffRequestsService } from './time-off-requests.service';
import { TimeOffRequestsController } from './time-off-requests.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeOffRequest, RequestStatusHistory, Balance]),
  ],
  controllers: [TimeOffRequestsController],
  providers: [TimeOffRequestsService],
  exports: [TimeOffRequestsService],
})
export class TimeOffRequestsModule {}

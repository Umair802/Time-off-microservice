import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmployeesModule } from './employees/employees.module';
import { LocationsModule } from './locations/locations.module';
import { LeaveTypesModule } from './leave-types/leave-types.module';
import { BalancesModule } from './balances/balances.module';
import { TimeOffRequestsModule } from './time-off-requests/time-off-requests.module';
import { HcmModule } from './hcm/hcm.module';
import { SyncModule } from './sync/sync.module';
import { Employee } from './employees/employee.entity';
import { Location } from './locations/location.entity';
import { LeaveType } from './leave-types/leave-type.entity';
import { Balance } from './balances/balance.entity';
import { TimeOffRequest } from './time-off-requests/time-off-request.entity';
import { RequestStatusHistory } from './time-off-requests/request-status-history.entity';
import { SyncLog } from './sync/sync-log.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'database.sqlite',
      entities: [
        Employee,
        Location,
        LeaveType,
        Balance,
        TimeOffRequest,
        RequestStatusHistory,
        SyncLog,
      ],
      synchronize: true,
    }),
    EmployeesModule,
    LocationsModule,
    LeaveTypesModule,
    BalancesModule,
    TimeOffRequestsModule,
    HcmModule,
    SyncModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

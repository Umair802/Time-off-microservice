import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Balance } from './balance.entity';
import { BalancesService } from './balances.service';
import { BalancesController } from './balances.controller';
import { EmployeesModule } from '../employees/employees.module';
import { LocationsModule } from '../locations/locations.module';
import { LeaveTypesModule } from '../leave-types/leave-types.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Balance]),
    EmployeesModule,
    LocationsModule,
    LeaveTypesModule,
  ],
  controllers: [BalancesController],
  providers: [BalancesService],
  exports: [BalancesService],
})
export class BalancesModule {}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EmployeesService } from './employees/employees.service';
import { LocationsService } from './locations/locations.service';
import { LeaveTypesService } from './leave-types/leave-types.service';
import { BalancesService } from './balances/balances.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const employeesService = app.get(EmployeesService);
  const locationsService = app.get(LocationsService);
  const leaveTypesService = app.get(LeaveTypesService);
  const balancesService = app.get(BalancesService);

  console.log('Seeding Database...');

  // Create Employees
  let emp1 = await employeesService.findByEmployeeId('EMP001').catch(() => null);
  if (!emp1) {
    emp1 = await employeesService.create({
      employeeId: 'EMP001',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
    });
  }

  let emp2 = await employeesService.findByEmployeeId('EMP002').catch(() => null);
  if (!emp2) {
    emp2 = await employeesService.create({
      employeeId: 'EMP002',
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'bob@example.com',
    });
  }

  // Create Locations
  let loc1 = await locationsService.findByLocationId('LOC001').catch(() => null);
  if (!loc1) {
    loc1 = await locationsService.create({
      locationId: 'LOC001',
      name: 'San Francisco',
    });
  }

  // Create Leave Types
  let vac = await leaveTypesService.findByCode('VACATION').catch(() => null);
  if (!vac) {
    vac = await leaveTypesService.create({
      code: 'VACATION',
      name: 'Vacation',
    });
  }

  let sick = await leaveTypesService.findByCode('SICK').catch(() => null);
  if (!sick) {
    sick = await leaveTypesService.create({
      code: 'SICK',
      name: 'Sick Leave',
    });
  }

  // Create Balances
  let bal1 = await balancesService.findByComposite(emp1.id, loc1.id, vac.id);
  if (!bal1) {
    await balancesService.create({
      employeeId: emp1.id,
      locationId: loc1.id,
      leaveTypeId: vac.id,
      available: 20,
      used: 0,
      pending: 0,
    });
  }

  let bal2 = await balancesService.findByComposite(emp2.id, loc1.id, vac.id);
  if (!bal2) {
    await balancesService.create({
      employeeId: emp2.id,
      locationId: loc1.id,
      leaveTypeId: vac.id,
      available: 15,
      used: 0,
      pending: 0,
    });
  }

  console.log('Seeding complete!');
  await app.close();
}

bootstrap();

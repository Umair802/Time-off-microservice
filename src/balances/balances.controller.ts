import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { BalancesService } from './balances.service';
import { CreateBalanceDto } from './dto/create-balance.dto';
import { UpdateBalanceDto } from './dto/update-balance.dto';

@Controller('balances')
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Post()
  create(@Body() createBalanceDto: CreateBalanceDto) {
    return this.balancesService.create(createBalanceDto);
  }

  @Get()
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('locationId') locationId?: string,
    @Query('leaveTypeId') leaveTypeId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const filters: any = {};
    if (employeeId) filters.employeeId = parseInt(employeeId, 10);
    if (locationId) filters.locationId = parseInt(locationId, 10);
    if (leaveTypeId) filters.leaveTypeId = parseInt(leaveTypeId, 10);

    return this.balancesService.findAll(
      filters,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.balancesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBalanceDto: UpdateBalanceDto,
  ) {
    return this.balancesService.update(id, updateBalanceDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.balancesService.remove(id);
  }
}

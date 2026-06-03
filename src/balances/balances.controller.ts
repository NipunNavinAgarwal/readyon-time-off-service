import { Controller, Get, Param, Query } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { toHttpError } from '../common/errors';
import { BalancesService } from './balances.service';

class GetBalanceQuery {
  @IsString()
  @IsNotEmpty()
  locationId: string;
}

@Controller('balances')
export class BalancesController {
  constructor(private readonly balances: BalancesService) {}

  @Get(':employeeId')
  async get(@Param('employeeId') employeeId: string, @Query() query: GetBalanceQuery) {
    try {
      return await this.balances.get(employeeId, query.locationId);
    } catch (error) {
      throw toHttpError(error);
    }
  }
}

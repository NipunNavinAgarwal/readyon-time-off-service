import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { toHttpError } from '../common/errors';
import { InMemoryHcmGateway } from '../hcm/in-memory-hcm.gateway';

class HcmBalanceDto {
  @IsString()
  employeeId: string;

  @IsString()
  locationId: string;

  @IsNumber()
  @Min(0)
  balanceDays: number;
}

class SeedHcmDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HcmBalanceDto)
  balances: HcmBalanceDto[];
}

class ConfigureHcmDto {
  @IsOptional()
  @IsBoolean()
  failNextDebit?: boolean;

  @IsOptional()
  @IsBoolean()
  unsafeSuccessNextDebit?: boolean;
}

@Controller('mock-hcm')
export class MockHcmController {
  constructor(private readonly hcm: InMemoryHcmGateway) {}

  @Post('reset')
  reset() {
    this.hcm.reset();
    return { ok: true };
  }

  @Post('balances')
  seed(@Body() body: SeedHcmDto) {
    this.hcm.seed(body.balances);
    return { ok: true, count: body.balances.length };
  }

  @Get('balance')
  async getBalance(@Query('employeeId') employeeId: string, @Query('locationId') locationId: string) {
    try {
      return await this.hcm.getBalance(employeeId, locationId);
    } catch (error) {
      throw toHttpError(error);
    }
  }

  @Post('failure-mode')
  configure(@Body() body: ConfigureHcmDto) {
    this.hcm.configureFailure(body);
    return { ok: true };
  }

  @Get('batch')
  async batch() {
    return { balances: await this.hcm.getBatchBalances() };
  }
}

import { Body, Controller, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsString, Min, ValidateNested } from 'class-validator';
import { toHttpError } from '../common/errors';
import { SyncService } from './sync.service';

class BatchBalanceDto {
  @IsString()
  employeeId: string;

  @IsString()
  locationId: string;

  @IsNumber()
  @Min(0)
  balanceDays: number;
}

class BatchSyncDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchBalanceDto)
  balances: BatchBalanceDto[];
}

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('hcm-batch')
  async batch(@Body() body: BatchSyncDto) {
    try {
      return await this.sync.syncFromPayload(body.balances);
    } catch (error) {
      throw toHttpError(error);
    }
  }

  @Post('hcm-batch/pull')
  async pullBatchFromHcm() {
    try {
      return await this.sync.syncFromHcmBatch();
    } catch (error) {
      throw toHttpError(error);
    }
  }
}

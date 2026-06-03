import { Module } from '@nestjs/common';
import { BalancesModule } from '../balances/balances.module';
import { HcmModule } from '../hcm/hcm.module';
import { TimeOffRequestsController } from './time-off-requests.controller';
import { TimeOffRequestsService } from './time-off-requests.service';

@Module({
  imports: [BalancesModule, HcmModule],
  controllers: [TimeOffRequestsController],
  providers: [TimeOffRequestsService],
  exports: [TimeOffRequestsService],
})
export class TimeOffRequestsModule {}

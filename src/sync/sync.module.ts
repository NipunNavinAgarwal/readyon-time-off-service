import { Module } from '@nestjs/common';
import { BalancesModule } from '../balances/balances.module';
import { HcmModule } from '../hcm/hcm.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [BalancesModule, HcmModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}

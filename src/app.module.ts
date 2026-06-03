import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { BalancesModule } from './balances/balances.module';
import { HcmModule } from './hcm/hcm.module';
import { MockHcmModule } from './mock-hcm/mock-hcm.module';
import { SyncModule } from './sync/sync.module';
import { TimeOffRequestsModule } from './time-off-requests/time-off-requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HcmModule,
    BalancesModule,
    TimeOffRequestsModule,
    SyncModule,
    MockHcmModule,
  ],
})
export class AppModule {}

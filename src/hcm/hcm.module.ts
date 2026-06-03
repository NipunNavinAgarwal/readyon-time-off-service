import { Module } from '@nestjs/common';
import { HcmClient } from './hcm.client';
import { InMemoryHcmGateway } from './in-memory-hcm.gateway';

@Module({
  providers: [InMemoryHcmGateway, { provide: HcmClient, useExisting: InMemoryHcmGateway }],
  exports: [HcmClient, InMemoryHcmGateway],
})
export class HcmModule {}

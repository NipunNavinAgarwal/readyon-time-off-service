import { Module } from '@nestjs/common';
import { HcmModule } from '../hcm/hcm.module';
import { MockHcmController } from './mock-hcm.controller';

@Module({
  imports: [HcmModule],
  controllers: [MockHcmController],
})
export class MockHcmModule {}

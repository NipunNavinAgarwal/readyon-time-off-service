import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { InMemoryHcmGateway } from '../src/hcm/in-memory-hcm.gateway';
import { PrismaService } from '../src/prisma/prisma.service';

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
  hcm: InMemoryHcmGateway;
}> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  const prisma = app.get(PrismaService);
  const hcm = app.get(InMemoryHcmGateway);
  await resetDb(prisma);
  hcm.reset();
  return { app, prisma, hcm };
}

export async function resetDb(prisma: PrismaService) {
  await prisma.balanceEvent.deleteMany();
  await prisma.timeOffRequest.deleteMany();
  await prisma.balance.deleteMany();
}

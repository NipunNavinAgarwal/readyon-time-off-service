import { Injectable } from '@nestjs/common';
import { BalancesService } from '../balances/balances.service';
import { HcmBalance, HcmClient } from '../hcm/hcm.client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SyncService {
  constructor(
    private readonly balances: BalancesService,
    private readonly hcm: HcmClient,
    private readonly prisma: PrismaService,
  ) {}

  async syncFromPayload(entries: HcmBalance[]) {
    return this.prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        await this.balances.upsertFromHcm(entry.employeeId, entry.locationId, entry.balanceDays, tx);
      }
      return { synced: entries.length };
    });
  }

  async syncFromHcmBatch() {
    const entries = await this.hcm.getBatchBalances();
    return this.syncFromPayload(entries);
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma, Balance } from '@prisma/client';
import { DomainError } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

export interface BalanceView {
  employeeId: string;
  locationId: string;
  hcmBalanceDays: number;
  reservedDays: number;
  availableDays: number;
  lastSyncedAt: Date;
}

type Tx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class BalancesService {
  constructor(private readonly prisma: PrismaService) {}

  availableDays(balance: Pick<Balance, 'hcmBalanceDays' | 'reservedDays'>): number {
    return roundDays(balance.hcmBalanceDays - balance.reservedDays);
  }

  toView(balance: Balance): BalanceView {
    return {
      employeeId: balance.employeeId,
      locationId: balance.locationId,
      hcmBalanceDays: balance.hcmBalanceDays,
      reservedDays: balance.reservedDays,
      availableDays: this.availableDays(balance),
      lastSyncedAt: balance.lastSyncedAt,
    };
  }

  async get(employeeId: string, locationId: string): Promise<BalanceView> {
    const balance = await this.prisma.balance.findUnique({
      where: { employeeId_locationId: { employeeId, locationId } },
    });
    if (!balance) {
      throw new DomainError('No balance exists for this employee/location.', 'not_found');
    }
    return this.toView(balance);
  }

  async upsertFromHcm(
    employeeId: string,
    locationId: string,
    hcmBalanceDays: number,
    tx: Tx = this.prisma,
  ): Promise<Balance> {
    assertPositiveOrZero(hcmBalanceDays, 'hcmBalanceDays');
    const balance = await tx.balance.upsert({
      where: { employeeId_locationId: { employeeId, locationId } },
      create: { employeeId, locationId, hcmBalanceDays, reservedDays: 0, lastSyncedAt: new Date() },
      update: { hcmBalanceDays, lastSyncedAt: new Date() },
    });
    await tx.balanceEvent.create({
      data: {
        employeeId,
        locationId,
        type: 'HCM_SYNC',
        delta: hcmBalanceDays,
        metadata: JSON.stringify({ hcmBalanceDays }),
      },
    });
    return balance;
  }

  async reserve(
    employeeId: string,
    locationId: string,
    days: number,
    requestId: string,
    tx: Tx,
  ): Promise<Balance> {
    assertPositive(days, 'days');
    const balance = await tx.balance.findUnique({
      where: { employeeId_locationId: { employeeId, locationId } },
    });
    if (!balance) {
      throw new DomainError('No balance exists for this employee/location.', 'not_found');
    }
    if (this.availableDays(balance) < days) {
      throw new DomainError('Insufficient ReadyOn available balance.', 'conflict');
    }

    const updated = await tx.balance.update({
      where: { employeeId_locationId: { employeeId, locationId } },
      data: { reservedDays: { increment: days } },
    });
    await tx.balanceEvent.create({
      data: { requestId, employeeId, locationId, type: 'RESERVED', delta: days },
    });
    return updated;
  }

  async release(
    employeeId: string,
    locationId: string,
    days: number,
    requestId: string,
    tx: Tx,
    type = 'RELEASED',
  ): Promise<Balance> {
    assertPositive(days, 'days');
    const balance = await tx.balance.findUnique({
      where: { employeeId_locationId: { employeeId, locationId } },
    });
    if (!balance || balance.reservedDays < days) {
      throw new DomainError('Cannot release more days than are reserved.', 'conflict');
    }
    const updated = await tx.balance.update({
      where: { employeeId_locationId: { employeeId, locationId } },
      data: { reservedDays: { decrement: days } },
    });
    await tx.balanceEvent.create({
      data: { requestId, employeeId, locationId, type, delta: -days },
    });
    return updated;
  }

  async applyApprovedDebit(
    employeeId: string,
    locationId: string,
    days: number,
    requestId: string,
    tx: Tx,
  ): Promise<Balance> {
    await this.release(employeeId, locationId, days, requestId, tx, 'APPROVED_RESERVATION_RELEASED');
    const balance = await tx.balance.update({
      where: { employeeId_locationId: { employeeId, locationId } },
      data: { hcmBalanceDays: { decrement: days }, lastSyncedAt: new Date() },
    });
    if (balance.hcmBalanceDays < -0.0001 || balance.reservedDays < -0.0001) {
      throw new DomainError('Approved debit would make ReadyOn balance invalid.', 'conflict');
    }
    await tx.balanceEvent.create({
      data: { requestId, employeeId, locationId, type: 'APPROVED_DEBIT', delta: -days },
    });
    return balance;
  }
}

function assertPositive(value: number, field: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainError(`${field} must be greater than zero.`);
  }
}

function assertPositiveOrZero(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new DomainError(`${field} must be zero or greater.`);
  }
}

function roundDays(value: number): number {
  return Math.round(value * 1000) / 1000;
}

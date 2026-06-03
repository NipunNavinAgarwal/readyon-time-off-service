import { Injectable } from '@nestjs/common';
import { TimeOffRequest } from '@prisma/client';
import { BalancesService } from '../balances/balances.service';
import { DomainError } from '../common/errors';
import { HcmClient } from '../hcm/hcm.client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimeOffRequestDto } from './dto';

@Injectable()
export class TimeOffRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: BalancesService,
    private readonly hcm: HcmClient,
  ) {}

  async create(dto: CreateTimeOffRequestDto): Promise<TimeOffRequest> {
    const hcmBalance = await this.hcm.getBalance(dto.employeeId, dto.locationId);
    if (hcmBalance.balanceDays < dto.days) {
      throw new DomainError('HCM reports insufficient balance.', 'conflict');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.balances.upsertFromHcm(dto.employeeId, dto.locationId, hcmBalance.balanceDays, tx);
      const request = await tx.timeOffRequest.create({
        data: {
          employeeId: dto.employeeId,
          locationId: dto.locationId,
          days: dto.days,
          status: TimeOffStatus.Pending,
          idempotencyKey: makeIdempotencyKey(dto.employeeId, dto.locationId),
        },
      });
      await this.balances.reserve(dto.employeeId, dto.locationId, dto.days, request.id, tx);
      return request;
    });
  }

  async get(id: string): Promise<TimeOffRequest> {
    const request = await this.prisma.timeOffRequest.findUnique({ where: { id } });
    if (!request) {
      throw new DomainError('Time-off request not found.', 'not_found');
    }
    return request;
  }

  async approve(id: string): Promise<TimeOffRequest> {
    const request = await this.get(id);
    if (request.status === TimeOffStatus.Approved) {
      return request;
    }
    if (request.status !== TimeOffStatus.Pending) {
      throw new DomainError(`Cannot approve a ${request.status} request.`, 'conflict');
    }

    const hcmResult = await this.hcm.debitTimeOff(
      request.employeeId,
      request.locationId,
      request.days,
      request.idempotencyKey,
    );
    if (hcmResult.remainingBalanceDays < 0) {
      await this.prisma.timeOffRequest.update({
        where: { id },
        data: { status: TimeOffStatus.Failed },
      });
      throw new DomainError('HCM returned an unsafe success with negative remaining balance.', 'conflict');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.balances.applyApprovedDebit(
        request.employeeId,
        request.locationId,
        request.days,
        request.id,
        tx,
      );
      return tx.timeOffRequest.update({
        where: { id },
        data: {
          status: TimeOffStatus.Approved,
          hcmTransactionId: hcmResult.transactionId,
        },
      });
    });
  }

  async reject(id: string): Promise<TimeOffRequest> {
    const request = await this.get(id);
    if (request.status === TimeOffStatus.Rejected) {
      return request;
    }
    if (request.status !== TimeOffStatus.Pending) {
      throw new DomainError(`Cannot reject a ${request.status} request.`, 'conflict');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.balances.release(request.employeeId, request.locationId, request.days, request.id, tx, 'REJECTED_RELEASE');
      return tx.timeOffRequest.update({
        where: { id },
        data: { status: TimeOffStatus.Rejected },
      });
    });
  }
}

export const TimeOffStatus = {
  Pending: 'PENDING',
  Approved: 'APPROVED',
  Rejected: 'REJECTED',
  Failed: 'FAILED',
} as const;

function makeIdempotencyKey(employeeId: string, locationId: string): string {
  return `${employeeId}:${locationId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

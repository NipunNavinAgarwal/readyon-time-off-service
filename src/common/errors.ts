import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

export class DomainError extends Error {
  constructor(
    message: string,
    readonly status: 'bad_request' | 'not_found' | 'conflict' = 'bad_request',
  ) {
    super(message);
  }
}

export function toHttpError(error: unknown): Error {
  if (!(error instanceof DomainError)) {
    return error instanceof Error ? error : new Error('Unknown error');
  }

  if (error.status === 'not_found') {
    return new NotFoundException(error.message);
  }
  if (error.status === 'conflict') {
    return new ConflictException(error.message);
  }
  return new BadRequestException(error.message);
}

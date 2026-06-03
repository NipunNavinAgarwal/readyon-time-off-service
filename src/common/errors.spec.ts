import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DomainError, toHttpError } from './errors';

describe('toHttpError', () => {
  it('maps domain errors to HTTP exceptions', () => {
    expect(toHttpError(new DomainError('missing', 'not_found'))).toBeInstanceOf(NotFoundException);
    expect(toHttpError(new DomainError('conflict', 'conflict'))).toBeInstanceOf(ConflictException);
    expect(toHttpError(new DomainError('bad'))).toBeInstanceOf(BadRequestException);
  });

  it('preserves ordinary errors and wraps unknown values', () => {
    const error = new Error('plain');

    expect(toHttpError(error)).toBe(error);
    expect(toHttpError('oops')).toBeInstanceOf(Error);
  });
});

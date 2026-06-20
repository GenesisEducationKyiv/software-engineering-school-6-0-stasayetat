import { E } from '@shared/either';
import { logger } from '@shared/logger';
import { DomainError, DomainErrorCode } from '@shared/types';
import { ErrorRequestHandler } from 'express';

export class HttpException extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpException';
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const message = getErrorMessage(err);

  logger.error(message);

  if (err instanceof HttpException) {
    return res.status(err.status).json({ message: err.message });
  }

  res.status(500).json({ message: 'Internal server error' });
};

export const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'Unknown');

export const domainErrorToHttpStatusMap: Record<DomainErrorCode, number> = {
  [DomainErrorCode.SUBSCRIPTION_NOT_FOUND]: 404,
  [DomainErrorCode.SUBSCRIPTION_ALREADY_EXISTS]: 409,
  [DomainErrorCode.EMAIL_SEND_FAILURE]: 500,
  [DomainErrorCode.REPO_HAS_NO_TAGS]: 404,
  [DomainErrorCode.GITHUB_RATE_LIMIT]: 429,
  [DomainErrorCode.GITHUB_REPO_NOT_FOUND]: 404,
  [DomainErrorCode.GITHUB_API_ERROR]: 500,
  [DomainErrorCode.SCANNER_ENROLLMENT_FAILED]: 500,
};

export const unpackOrThrowException = <T>(either: E.Either<DomainError, T>) => {
  if (E.isLeft(either)) {
    const exception = either.value;

    const status = domainErrorToHttpStatusMap[exception.code];

    throw new HttpException(status, exception.code);
  }

  return either.value;
};

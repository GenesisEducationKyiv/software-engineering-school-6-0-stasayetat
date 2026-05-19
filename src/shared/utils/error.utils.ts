import { E } from '@shared/either';
import { logger } from '@shared/logger';
import { ApiResponseException, ApiResponseExceptionCode } from '@shared/types';
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

export const apiResponseToHttpExceptionCodesMap: Record<ApiResponseExceptionCode, number> = {
  [ApiResponseExceptionCode.GENERAL_FAILURE]: 500,
  [ApiResponseExceptionCode.NOT_FOUND]: 404,
  [ApiResponseExceptionCode.RATE_LIMIT]: 429,
  [ApiResponseExceptionCode.UNKNOWN]: 500,
  [ApiResponseExceptionCode.ALREADY_EXISTS]: 409,
};

export const unpackOrThrowException = <T>(either: E.Either<ApiResponseException, T>) => {
  if (E.isLeft(either)) {
    const exception = either.value;

    const status = apiResponseToHttpExceptionCodesMap[exception.code];

    throw new HttpException(status, exception.code);
  }

  return either.value;
};

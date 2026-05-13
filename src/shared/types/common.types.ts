export enum ApiResponseExceptionCode {
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN = 'UNKNOWN',
  GENERAL_FAILURE = 'GENERAL_FAILURE',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
}

export type ApiResponseException = {
  code: ApiResponseExceptionCode;
  message: string;
  body?: unknown;
};

export type FailureResult = { success: false; message: string };
export type SuccessResult = { success: true };

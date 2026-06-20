export enum DomainErrorCode {
  SUBSCRIPTION_NOT_FOUND = 'SUBSCRIPTION_NOT_FOUND',
  SUBSCRIPTION_ALREADY_EXISTS = 'SUBSCRIPTION_ALREADY_EXISTS',
  EMAIL_SEND_FAILURE = 'EMAIL_SEND_FAILURE',
  REPO_HAS_NO_TAGS = 'REPO_HAS_NO_TAGS',
  GITHUB_RATE_LIMIT = 'GITHUB_RATE_LIMIT',
  GITHUB_REPO_NOT_FOUND = 'GITHUB_REPO_NOT_FOUND',
  GITHUB_API_ERROR = 'GITHUB_API_ERROR',
  SCANNER_ENROLLMENT_FAILED = 'SCANNER_ENROLLMENT_FAILED',
}

export type DomainError = {
  code: DomainErrorCode;
  message: string;
  body?: unknown;
};

export type FailureResult = { success: false; message: string };
export type SuccessResult = { success: true };

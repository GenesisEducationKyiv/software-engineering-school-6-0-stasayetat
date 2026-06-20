import { status, StatusObject } from '@grpc/grpc-js';
import { DomainError, DomainErrorCode } from '@shared/types';

export const domainErrorToGrpcStatusMap: Record<DomainErrorCode, status> = {
  [DomainErrorCode.SUBSCRIPTION_NOT_FOUND]: status.NOT_FOUND,
  [DomainErrorCode.SUBSCRIPTION_ALREADY_EXISTS]: status.ALREADY_EXISTS,
  [DomainErrorCode.EMAIL_SEND_FAILURE]: status.INTERNAL,
  [DomainErrorCode.REPO_HAS_NO_TAGS]: status.NOT_FOUND,
  [DomainErrorCode.GITHUB_RATE_LIMIT]: status.RESOURCE_EXHAUSTED,
  [DomainErrorCode.GITHUB_REPO_NOT_FOUND]: status.NOT_FOUND,
  [DomainErrorCode.GITHUB_API_ERROR]: status.INTERNAL,
  [DomainErrorCode.SCANNER_ENROLLMENT_FAILED]: status.INTERNAL,
};

export function toGrpcError(err: DomainError): Partial<StatusObject> {
  return {
    code: domainErrorToGrpcStatusMap[err.code],
    details: err.message,
  };
}

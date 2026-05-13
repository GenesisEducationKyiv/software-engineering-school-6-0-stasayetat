import { status, StatusObject } from '@grpc/grpc-js';
import { ApiResponseException, ApiResponseExceptionCode } from '@shared/types';

export const apiResponseToGrpcStatusMap: Record<ApiResponseExceptionCode, status> = {
  [ApiResponseExceptionCode.GENERAL_FAILURE]: status.INTERNAL,
  [ApiResponseExceptionCode.NOT_FOUND]: status.NOT_FOUND,
  [ApiResponseExceptionCode.RATE_LIMIT]: status.RESOURCE_EXHAUSTED,
  [ApiResponseExceptionCode.UNKNOWN]: status.UNKNOWN,
  [ApiResponseExceptionCode.ALREADY_EXISTS]: status.ALREADY_EXISTS,
};

export function toGrpcError(err: ApiResponseException): Partial<StatusObject> {
  return {
    code: apiResponseToGrpcStatusMap[err.code],
    details: err.message,
  };
}

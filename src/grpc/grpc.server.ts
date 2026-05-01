import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { subscriptionService } from '@modules/subscription';
import { ConfirmDto, GetSubscriptionsDto, SubscribeDto, UnsubscribeDto } from '@shared/dtos';
import { logger } from '@shared/logger';
import { ApiResponse, GetSubscriptionsResponse } from '@shared/types';
import path from 'path';

import { authInterceptor } from './interceptors/auth.interceptor';
import { validateGrpc } from './interceptors/validate-grpc';
import { ProtoGrpcType } from './proto-types/subscription';

const PROTO_PATH = path.resolve(__dirname, './subscription.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition) as unknown as ProtoGrpcType;

async function subscribe(
  call: grpc.ServerUnaryCall<SubscribeDto, ApiResponse>,
  callback: grpc.sendUnaryData<ApiResponse>,
) {
  const dto = await validateGrpc(SubscribeDto, call.request, callback);

  if (!dto) {
    return;
  }

  const result = await subscriptionService.subscribe(dto.email, dto.repo);
  callback(null, result);
}

async function confirm(call: grpc.ServerUnaryCall<ConfirmDto, ApiResponse>, callback: grpc.sendUnaryData<ApiResponse>) {
  const dto = await validateGrpc(ConfirmDto, call.request, callback);

  if (!dto) {
    return;
  }

  const result = await subscriptionService.confirmSubscribe(dto.token);
  callback(null, result);
}

async function unsubscribe(
  call: grpc.ServerUnaryCall<UnsubscribeDto, ApiResponse>,
  callback: grpc.sendUnaryData<ApiResponse>,
) {
  const dto = await validateGrpc(UnsubscribeDto, call.request, callback);

  if (!dto) {
    return;
  }

  const result = await subscriptionService.confirmUnsubscribe(dto.token);
  callback(null, result);
}

async function getSubscriptions(
  call: grpc.ServerUnaryCall<GetSubscriptionsDto, GetSubscriptionsResponse>,
  callback: grpc.sendUnaryData<GetSubscriptionsResponse>,
) {
  const dto = await validateGrpc(GetSubscriptionsDto, call.request, callback);

  if (!dto) {
    return;
  }

  const result = await subscriptionService.getAllSubscriptionsByEmail(dto.email);
  callback(null, result);
}

export function startGrpcServer(port: number) {
  const server = new grpc.Server({
    interceptors: [authInterceptor],
  });

  server.addService(proto.subscription.SubscriptionService.service, {
    subscribe: (call: grpc.ServerUnaryCall<SubscribeDto, ApiResponse>, callback: grpc.sendUnaryData<ApiResponse>) =>
      void subscribe(call, callback),

    confirm: (call: grpc.ServerUnaryCall<ConfirmDto, ApiResponse>, callback: grpc.sendUnaryData<ApiResponse>) =>
      void confirm(call, callback),

    unsubscribe: (call: grpc.ServerUnaryCall<UnsubscribeDto, ApiResponse>, callback: grpc.sendUnaryData<ApiResponse>) =>
      void unsubscribe(call, callback),

    getSubscriptions: (
      call: grpc.ServerUnaryCall<GetSubscriptionsDto, GetSubscriptionsResponse>,
      callback: grpc.sendUnaryData<GetSubscriptionsResponse>,
    ) => void getSubscriptions(call, callback),
  });

  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
    if (err) {
      logger.error(`gRPC server error: ${err.message}`);

      return;
    }

    logger.info(`gRPC server started on port ${boundPort}`);
  });
}

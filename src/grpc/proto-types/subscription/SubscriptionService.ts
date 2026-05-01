// Original file: src/grpc/subscription.proto
import type * as grpc from '@grpc/grpc-js';
import type { MethodDefinition } from '@grpc/proto-loader';

import type {
  GetSubscriptionsRequest as _subscription_GetSubscriptionsRequest,
  GetSubscriptionsRequest__Output as _subscription_GetSubscriptionsRequest__Output,
} from '../subscription/GetSubscriptionsRequest';
import type {
  GetSubscriptionsResponse as _subscription_GetSubscriptionsResponse,
  GetSubscriptionsResponse__Output as _subscription_GetSubscriptionsResponse__Output,
} from '../subscription/GetSubscriptionsResponse';
import type {
  MessageResponse as _subscription_MessageResponse,
  MessageResponse__Output as _subscription_MessageResponse__Output,
} from '../subscription/MessageResponse';
import type {
  SubscribeRequest as _subscription_SubscribeRequest,
  SubscribeRequest__Output as _subscription_SubscribeRequest__Output,
} from '../subscription/SubscribeRequest';
import type {
  SubscribeResponse as _subscription_SubscribeResponse,
  SubscribeResponse__Output as _subscription_SubscribeResponse__Output,
} from '../subscription/SubscribeResponse';
import type {
  TokenRequest as _subscription_TokenRequest,
  TokenRequest__Output as _subscription_TokenRequest__Output,
} from '../subscription/TokenRequest';

export interface SubscriptionServiceClient extends grpc.Client {
  Confirm(
    argument: _subscription_TokenRequest,
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_subscription_MessageResponse__Output>,
  ): grpc.ClientUnaryCall;
  Confirm(
    argument: _subscription_TokenRequest,
    metadata: grpc.Metadata,
    callback: grpc.requestCallback<_subscription_MessageResponse__Output>,
  ): grpc.ClientUnaryCall;
  Confirm(
    argument: _subscription_TokenRequest,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_subscription_MessageResponse__Output>,
  ): grpc.ClientUnaryCall;
  Confirm(
    argument: _subscription_TokenRequest,
    callback: grpc.requestCallback<_subscription_MessageResponse__Output>,
  ): grpc.ClientUnaryCall;
  confirm(
    argument: _subscription_TokenRequest,
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_subscription_MessageResponse__Output>,
  ): grpc.ClientUnaryCall;
  confirm(
    argument: _subscription_TokenRequest,
    metadata: grpc.Metadata,
    callback: grpc.requestCallback<_subscription_MessageResponse__Output>,
  ): grpc.ClientUnaryCall;
  confirm(
    argument: _subscription_TokenRequest,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_subscription_MessageResponse__Output>,
  ): grpc.ClientUnaryCall;
  confirm(
    argument: _subscription_TokenRequest,
    callback: grpc.requestCallback<_subscription_MessageResponse__Output>,
  ): grpc.ClientUnaryCall;

  GetSubscriptions(
    argument: _subscription_GetSubscriptionsRequest,
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_subscription_GetSubscriptionsResponse__Output>,
  ): grpc.ClientUnaryCall;
  GetSubscriptions(
    argument: _subscription_GetSubscriptionsRequest,
    metadata: grpc.Metadata,
    callback: grpc.requestCallback<_subscription_GetSubscriptionsResponse__Output>,
  ): grpc.ClientUnaryCall;
  GetSubscriptions(
    argument: _subscription_GetSubscriptionsRequest,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_subscription_GetSubscriptionsResponse__Output>,
  ): grpc.ClientUnaryCall;
  GetSubscriptions(
    argument: _subscription_GetSubscriptionsRequest,
    callback: grpc.requestCallback<_subscription_GetSubscriptionsResponse__Output>,
  ): grpc.ClientUnaryCall;
  getSubscriptions(
    argument: _subscription_GetSubscriptionsRequest,
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_subscription_GetSubscriptionsResponse__Output>,
  ): grpc.ClientUnaryCall;
  getSubscriptions(
    argument: _subscription_GetSubscriptionsRequest,
    metadata: grpc.Metadata,
    callback: grpc.requestCallback<_subscription_GetSubscriptionsResponse__Output>,
  ): grpc.ClientUnaryCall;
  getSubscriptions(
    argument: _subscription_GetSubscriptionsRequest,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_subscription_GetSubscriptionsResponse__Output>,
  ): grpc.ClientUnaryCall;
  getSubscriptions(
    argument: _subscription_GetSubscriptionsRequest,
    callback: grpc.requestCallback<_subscription_GetSubscriptionsResponse__Output>,
  ): grpc.ClientUnaryCall;

  Subscribe(
    argument: _subscription_SubscribeRequest,
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_subscription_SubscribeResponse__Output>,
  ): grpc.ClientUnaryCall;
  Subscribe(
    argument: _subscription_SubscribeRequest,
    metadata: grpc.Metadata,
    callback: grpc.requestCallback<_subscription_SubscribeResponse__Output>,
  ): grpc.ClientUnaryCall;
  Subscribe(
    argument: _subscription_SubscribeRequest,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_subscription_SubscribeResponse__Output>,
  ): grpc.ClientUnaryCall;
  Subscribe(
    argument: _subscription_SubscribeRequest,
    callback: grpc.requestCallback<_subscription_SubscribeResponse__Output>,
  ): grpc.ClientUnaryCall;
  subscribe(
    argument: _subscription_SubscribeRequest,
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_subscription_SubscribeResponse__Output>,
  ): grpc.ClientUnaryCall;
  subscribe(
    argument: _subscription_SubscribeRequest,
    metadata: grpc.Metadata,
    callback: grpc.requestCallback<_subscription_SubscribeResponse__Output>,
  ): grpc.ClientUnaryCall;
  subscribe(
    argument: _subscription_SubscribeRequest,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_subscription_SubscribeResponse__Output>,
  ): grpc.ClientUnaryCall;
  subscribe(
    argument: _subscription_SubscribeRequest,
    callback: grpc.requestCallback<_subscription_SubscribeResponse__Output>,
  ): grpc.ClientUnaryCall;

  Unsubscribe(
    argument: _subscription_TokenRequest,
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_subscription_MessageResponse__Output>,
  ): grpc.ClientUnaryCall;
  Unsubscribe(
    argument: _subscription_TokenRequest,
    metadata: grpc.Metadata,
    callback: grpc.requestCallback<_subscription_MessageResponse__Output>,
  ): grpc.ClientUnaryCall;
  Unsubscribe(
    argument: _subscription_TokenRequest,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_subscription_MessageResponse__Output>,
  ): grpc.ClientUnaryCall;
  Unsubscribe(
    argument: _subscription_TokenRequest,
    callback: grpc.requestCallback<_subscription_MessageResponse__Output>,
  ): grpc.ClientUnaryCall;
  unsubscribe(
    argument: _subscription_TokenRequest,
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_subscription_MessageResponse__Output>,
  ): grpc.ClientUnaryCall;
  unsubscribe(
    argument: _subscription_TokenRequest,
    metadata: grpc.Metadata,
    callback: grpc.requestCallback<_subscription_MessageResponse__Output>,
  ): grpc.ClientUnaryCall;
  unsubscribe(
    argument: _subscription_TokenRequest,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_subscription_MessageResponse__Output>,
  ): grpc.ClientUnaryCall;
  unsubscribe(
    argument: _subscription_TokenRequest,
    callback: grpc.requestCallback<_subscription_MessageResponse__Output>,
  ): grpc.ClientUnaryCall;
}

export interface SubscriptionServiceHandlers extends grpc.UntypedServiceImplementation {
  Confirm: grpc.handleUnaryCall<_subscription_TokenRequest__Output, _subscription_MessageResponse>;

  GetSubscriptions: grpc.handleUnaryCall<
    _subscription_GetSubscriptionsRequest__Output,
    _subscription_GetSubscriptionsResponse
  >;

  Subscribe: grpc.handleUnaryCall<_subscription_SubscribeRequest__Output, _subscription_SubscribeResponse>;

  Unsubscribe: grpc.handleUnaryCall<_subscription_TokenRequest__Output, _subscription_MessageResponse>;
}

export interface SubscriptionServiceDefinition extends grpc.ServiceDefinition {
  Confirm: MethodDefinition<
    _subscription_TokenRequest,
    _subscription_MessageResponse,
    _subscription_TokenRequest__Output,
    _subscription_MessageResponse__Output
  >;
  GetSubscriptions: MethodDefinition<
    _subscription_GetSubscriptionsRequest,
    _subscription_GetSubscriptionsResponse,
    _subscription_GetSubscriptionsRequest__Output,
    _subscription_GetSubscriptionsResponse__Output
  >;
  Subscribe: MethodDefinition<
    _subscription_SubscribeRequest,
    _subscription_SubscribeResponse,
    _subscription_SubscribeRequest__Output,
    _subscription_SubscribeResponse__Output
  >;
  Unsubscribe: MethodDefinition<
    _subscription_TokenRequest,
    _subscription_MessageResponse,
    _subscription_TokenRequest__Output,
    _subscription_MessageResponse__Output
  >;
}

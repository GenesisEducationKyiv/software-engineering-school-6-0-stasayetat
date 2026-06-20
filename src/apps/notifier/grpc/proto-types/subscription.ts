import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type {
  GetSubscriptionsRequest as _subscription_GetSubscriptionsRequest,
  GetSubscriptionsRequest__Output as _subscription_GetSubscriptionsRequest__Output,
} from './subscription/GetSubscriptionsRequest';
import type {
  GetSubscriptionsResponse as _subscription_GetSubscriptionsResponse,
  GetSubscriptionsResponse__Output as _subscription_GetSubscriptionsResponse__Output,
} from './subscription/GetSubscriptionsResponse';
import type {
  MessageResponse as _subscription_MessageResponse,
  MessageResponse__Output as _subscription_MessageResponse__Output,
} from './subscription/MessageResponse';
import type {
  SubscribeRequest as _subscription_SubscribeRequest,
  SubscribeRequest__Output as _subscription_SubscribeRequest__Output,
} from './subscription/SubscribeRequest';
import type {
  SubscribeResponse as _subscription_SubscribeResponse,
  SubscribeResponse__Output as _subscription_SubscribeResponse__Output,
} from './subscription/SubscribeResponse';
import type {
  Subscription as _subscription_Subscription,
  Subscription__Output as _subscription_Subscription__Output,
} from './subscription/Subscription';
import type {
  SubscriptionServiceClient as _subscription_SubscriptionServiceClient,
  SubscriptionServiceDefinition as _subscription_SubscriptionServiceDefinition,
} from './subscription/SubscriptionService';
import type {
  TokenRequest as _subscription_TokenRequest,
  TokenRequest__Output as _subscription_TokenRequest__Output,
} from './subscription/TokenRequest';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new (...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  subscription: {
    GetSubscriptionsRequest: MessageTypeDefinition<
      _subscription_GetSubscriptionsRequest,
      _subscription_GetSubscriptionsRequest__Output
    >;
    GetSubscriptionsResponse: MessageTypeDefinition<
      _subscription_GetSubscriptionsResponse,
      _subscription_GetSubscriptionsResponse__Output
    >;
    MessageResponse: MessageTypeDefinition<_subscription_MessageResponse, _subscription_MessageResponse__Output>;
    SubscribeRequest: MessageTypeDefinition<_subscription_SubscribeRequest, _subscription_SubscribeRequest__Output>;
    SubscribeResponse: MessageTypeDefinition<_subscription_SubscribeResponse, _subscription_SubscribeResponse__Output>;
    Subscription: MessageTypeDefinition<_subscription_Subscription, _subscription_Subscription__Output>;
    SubscriptionService: SubtypeConstructor<typeof grpc.Client, _subscription_SubscriptionServiceClient> & {
      service: _subscription_SubscriptionServiceDefinition;
    };
    TokenRequest: MessageTypeDefinition<_subscription_TokenRequest, _subscription_TokenRequest__Output>;
  };
}

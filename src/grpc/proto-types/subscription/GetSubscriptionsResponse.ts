// Original file: src/grpc/subscription.proto
import type {
  Subscription as _subscription_Subscription,
  Subscription__Output as _subscription_Subscription__Output,
} from '../subscription/Subscription';

export interface GetSubscriptionsResponse {
  status?: number;
  data?: _subscription_Subscription[];
}

export interface GetSubscriptionsResponse__Output {
  status: number;
  data: _subscription_Subscription__Output[];
}

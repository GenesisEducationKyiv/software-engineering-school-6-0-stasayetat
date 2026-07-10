// Original file: src/grpc/subscription.proto

export interface Subscription {
  email?: string;
  repo?: string;
  confirmed?: boolean;
  lastSeenTag?: string;
}

export interface Subscription__Output {
  email: string;
  repo: string;
  confirmed: boolean;
  lastSeenTag: string;
}

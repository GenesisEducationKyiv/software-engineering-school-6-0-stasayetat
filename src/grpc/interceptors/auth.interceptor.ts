import * as grpc from '@grpc/grpc-js';
import { env } from '@shared/env';

export const authInterceptor = (
  methodDescriptor: grpc.ServerMethodDefinition<any, any>,
  call: grpc.ServerInterceptingCallInterface,
) => {
  const listener = new grpc.ServerListenerBuilder()
    .withOnReceiveMetadata((metadata, next) => {
      const apiKey = metadata.get('x-api-key')[0];

      if (!apiKey || apiKey !== env.APP_API_KEY) {
        call.sendStatus({
          code: grpc.status.UNAUTHENTICATED,
          details: 'Invalid API key',
        });

        return;
      }

      next(metadata);
    })
    .build();

  const responder = new grpc.ResponderBuilder().withStart(next => next(listener)).build();

  return new grpc.ServerInterceptingCall(call, responder);
};

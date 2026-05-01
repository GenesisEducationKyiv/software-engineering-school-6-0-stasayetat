import * as grpc from '@grpc/grpc-js';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

export async function validateGrpc<T extends object>(
  DtoClass: new () => T,
  data: unknown,
  callback: grpc.sendUnaryData<any>,
): Promise<T | null> {
  const instance = plainToInstance(DtoClass, data);
  const errors = await validate(instance as object);

  if (errors.length > 0) {
    const message = errors.map(e => Object.values(e.constraints ?? {}).join(', ')).join('; ');

    callback(
      {
        code: grpc.status.INVALID_ARGUMENT,
        message,
      },
      null,
    );

    return null;
  }

  return instance;
}

import zod from 'zod';

export const CoerceStringToBoolean = zod
  .enum(['true', 'false'])
  .default('false')
  .transform(val => val === 'true');

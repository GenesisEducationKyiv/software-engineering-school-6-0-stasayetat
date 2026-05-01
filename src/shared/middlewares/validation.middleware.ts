import { validate, ValidationError } from 'class-validator';
import { NextFunction, Request, Response } from 'express';

export function validateBody<T extends object>(dtoClass: new () => T) {
  return validationMiddleware(dtoClass, 'body');
}

export function validateParams<T extends object>(dtoClass: new () => T) {
  return validationMiddleware(dtoClass, 'params');
}

export function validateQuery<T extends object>(dtoClass: new () => T) {
  return validationMiddleware(dtoClass, 'query');
}

export function validationMiddleware<T extends object>(dtoClass: new () => T, body: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const dtoInstance = new dtoClass();
    const requestBody: Record<string, unknown> = {
      body: req.body,
      query: req.query,
      params: req.params,
    };

    Object.assign(dtoInstance, requestBody[body]);
    requestBody[body] = dtoInstance;

    const errors: ValidationError[] = await validate(dtoInstance, {
      forbidUnknownValues: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const validationErrors = errors.map(error => ({
        [error.property]: Object.values(error.constraints || {}),
      }));

      const errorMessage = 'Invalid data provided';
      const errorResponse = { message: errorMessage, errors: validationErrors };

      return res.status(400).json(errorResponse);
    }

    next();
  };
}

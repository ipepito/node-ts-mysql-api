import { Request, NextFunction } from 'express';
import Joi from 'joi';

export function validateRequest(req: Request, next: NextFunction, schema: Joi.Schema) {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    next(error.details.map((d: any) => d.message).join(', '));
  } else {
    next();
  }
}
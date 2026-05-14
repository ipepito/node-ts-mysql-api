import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (typeof err === 'string') {
    const is404 = err.toLowerCase().endsWith('not found');
    return res.status(is404 ? 404 : 400).json({ message: err });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  console.error(err);
  return res.status(500).json({ message: err.message });
}
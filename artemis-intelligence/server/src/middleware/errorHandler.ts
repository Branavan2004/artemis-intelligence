import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  // Always log the full error server-side
  console.error('[Error]', err.message);
  console.error(err.stack);

  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // Never leak internal error details or stack traces to the client
    res.status(500).json({ error: 'Internal server error' });
  } else {
    // In development, return the message and stack for easier debugging
    res.status(500).json({
      error: err.message || 'Internal server error',
      stack: err.stack,
    });
  }
}

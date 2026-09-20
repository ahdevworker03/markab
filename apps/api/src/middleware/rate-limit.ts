import type { NextFunction, Request, RequestHandler, Response } from "express";

interface RateLimitOptions {
  limit: number;
  windowMs: number;
  key?: (req: Request) => string;
}

export function createRateLimiter({
  limit,
  windowMs,
  key = (req) => req.ip ?? "unknown",
}: RateLimitOptions): RequestHandler {
  const requests = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const requestKey = key(req);
    const current = requests.get(requestKey);

    if (!current || current.resetAt <= now) {
      requests.set(requestKey, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (current.count >= limit) {
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
        },
      });
      return;
    }

    current.count += 1;
    next();
  };
}

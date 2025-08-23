import { SetMetadata } from '@nestjs/common';
import { RateLimitConfig } from '../guards/rate-limit.guard';

export const RATE_LIMIT_KEY = 'rateLimit';

export const RateLimit = (config: RateLimitConfig) => 
  SetMetadata(RATE_LIMIT_KEY, config);
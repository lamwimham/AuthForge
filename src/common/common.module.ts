import { Module, Global } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { CacheService } from './services/cache.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CommonModule {}
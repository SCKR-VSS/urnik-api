import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MikroORM, raw } from '@mikro-orm/core';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/auth/public.decorator';
import { API_KEY_ACCESS_KEY } from 'src/auth/api-key-access.decorator';
import { ApiKey } from 'src/database/entities/api-key.entity';

const RATE_LIMIT = 6;
const RATE_WINDOW_MS = 1000;

@Injectable()
export class AccessGuard implements CanActivate {
  private readonly rateLimitMap = new Map<string, number[]>();

  constructor(
    private readonly configService: ConfigService,
    private readonly orm: MikroORM,
    private readonly reflector: Reflector,
  ) {}

  private checkRateLimit(key: string): void {
    const now = Date.now();
    const windowStart = now - RATE_WINDOW_MS;
    const timestamps = (this.rateLimitMap.get(key) ?? []).filter(
      (t) => t > windowStart,
    );
    if (timestamps.length >= RATE_LIMIT) {
      this.rateLimitMap.set(key, timestamps);
      throw new HttpException('Rate limit exceeded: max 6 requests per second.', HttpStatus.TOO_MANY_REQUESTS);
    }
    timestamps.push(now);
    this.rateLimitMap.set(key, timestamps);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    if (request.path === '/docs' || request.path === '/mailing/remove') return true;

    const origin = request.headers.origin;

    const allowedDomains = [
      this.configService.get<string>('ALLOWED_DOMAIN'),
      this.configService.get<string>('API_DOMAIN'),
    ];

    if (origin && allowedDomains.includes(origin)) {
      return true;
    }

    const providedKey = request.headers['x-api-key'];

    if (!providedKey) {
      throw new UnauthorizedException('API key is missing.');
    }

    const allowsApiKey = this.reflector.getAllAndOverride<boolean>(API_KEY_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!allowsApiKey) {
      throw new UnauthorizedException('API key access is not allowed for this endpoint.');
    }

    const em = this.orm.em.fork();

    const apiKey = await em.findOne(ApiKey, { key: providedKey });

    if (!apiKey || apiKey.revoked) {
      throw new UnauthorizedException('Invalid API key.');
    }

    this.checkRateLimit(providedKey);

    void em
      .nativeUpdate(ApiKey, { key: providedKey }, { usageCount: raw('usage_count + 1') })
      .catch(() => {});

    return true;
  }
}

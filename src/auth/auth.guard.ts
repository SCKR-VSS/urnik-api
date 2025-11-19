import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/auth/public.decorator';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.configService.get<string>('NODE_ENV') === 'development') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    if (request.path === '/docs') return true;

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

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { key: providedKey },
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key.');
    }

    return true;
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    if (this.configService.get<string>('NODE_ENV') === 'development') {
      return true;
    }
    const request = context.switchToHttp().getRequest();

    if (request.path === '/docs') return true;

    const origin = request.headers.origin;
    const allowedDomains = [this.configService.get<string>('ALLOWED_DOMAIN'), this.configService.get<string>('API_DOMAIN')];

    if (origin && allowedDomains.includes(origin)) {
      return true;
    }

    const apiKey = request.headers['x-api-key'];
    if (!apiKey) {
      throw new UnauthorizedException('API Key is required');
    }

    const keyExists = this.prismaService.apiKey.findUnique({
      where: { key: apiKey },
    });

    if (!keyExists) {
      throw new UnauthorizedException('Invalid API Key');
    }

    this.prismaService.apiKey.update({
      where: { key: apiKey },
      data: { usageCount: { increment: 1 } },
    });

    return true;
  }
}

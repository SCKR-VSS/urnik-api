import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedKey = request.headers['x-admin-key'];
    const adminSecret = this.configService.get<string>('ADMIN_SECRET');

    if (!adminSecret) {
      throw new UnauthorizedException('Admin access is not configured.');
    }

    if (!providedKey || providedKey !== adminSecret) {
      throw new UnauthorizedException('Invalid or missing admin key.');
    }

    return true;
  }
}

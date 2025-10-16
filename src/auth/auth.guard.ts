import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
//import { ApiKeyService } from '../api-key.service';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly apiKeyService: any,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    if (this.configService.get<string>('NODE_ENV') === 'development') {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const origin = request.headers.origin;
    const allowedDomain = this.configService.get<string>('ALLOWED_DOMAIN');

    console.log(allowedDomain)

    if (origin === allowedDomain) {
      return true;
    }

    const apiKey = request.headers['x-api-key'];
    if (!apiKey) {
      throw new UnauthorizedException('API Key is required');
    }

    return this.apiKeyService.validateApiKey(apiKey);
  }
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AccessGuard } from './auth/access.guard';
import { ConfigService } from '@nestjs/config';
//import { ApiKeyService } from './auth/api-key.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  app.useGlobalGuards(new AccessGuard(configService, ""));

  await app.listen(3000);
}
bootstrap();
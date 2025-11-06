import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AccessGuard } from './auth/auth.guard';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('VSŠ Kranj Urnik API')
    .setDescription('API za VSŠ Kranj urnik API\n\nČe želite uporabljati API se obrnite na trenutnega skrbnika: nejc.zivic@vss.sckr.si')
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'Vnesite vaš API ključ tukaj',
      },
      'apiKey'
    )
    .addSecurityRequirements('apiKey')
    .build()

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('swagger', app, document);

  app.use('/docs', apiReference({ content: document, theme: 'kepler' }));

  const configService = app.get(ConfigService);
  const prismaService = app.get(PrismaService);

  app.useGlobalGuards(new AccessGuard(configService, prismaService));

  await app.listen(3000);
}
bootstrap();
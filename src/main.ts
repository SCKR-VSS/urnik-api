import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      app.get(ConfigService).get<string>('ALLOWED_DOMAIN'),
      app.get(ConfigService).get<string>('API_DOMAIN'),
      "http://localhost:3001",
      "http://192.168.1.40:3001"
    ]
  });

  const config = new DocumentBuilder()
    .setTitle('VSŠ Kranj Urnik API')
    .setDescription(
      'API za VSŠ Kranj urnik API\n\nČe želite uporabljati API se obrnite na trenutnega skrbnika: nejc.zivic@vss.sckr.si',
    )
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'Vnesite vaš API ključ tukaj',
      },
      'apiKey',
    )
    .addSecurityRequirements('apiKey')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('swagger', app, document);

  app.use('/docs', apiReference({ content: document, theme: 'kepler' }));

  const configService = app.get(ConfigService);

  // uncomment if exposing locally
  //return await app.listen(3000, '0.0.0.0');
  await app.listen(process.env.PORT || 3000);
}
bootstrap();

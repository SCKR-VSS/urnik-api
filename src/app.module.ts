import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OptionsModule } from './options/options.module';

@Module({
  imports: [
    AuthModule,
    OptionsModule,
    CacheModule.register({
      isGlobal: true,
      ttl: 10 * 60 * 1000
    })
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

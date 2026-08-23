import 'reflect-metadata';
import 'dotenv/config';
import { defineConfig } from '@mikro-orm/mysql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { SchoolClass } from './src/database/entities/school-class.entity';
import { Week } from './src/database/entities/week.entity';
import { Timetable } from './src/database/entities/timetable.entity';
import { Mail } from './src/database/entities/mail.entity';
import { Professor } from './src/database/entities/professor.entity';
import { ApiKey } from './src/database/entities/api-key.entity';
import { PushSubscription } from './src/database/entities/push-subscription.entity';
import { Profmail } from './src/database/entities/profmail.entity';

export default defineConfig({
  entities: [SchoolClass, Week, Timetable, Mail, Professor, ApiKey, PushSubscription, Profmail],
  clientUrl: process.env.DATABASE_URL,
  metadataProvider: TsMorphMetadataProvider,
  migrations: {
    path: './src/database/migrations',
    glob: '!(*.d).{js,ts}',
  },
});

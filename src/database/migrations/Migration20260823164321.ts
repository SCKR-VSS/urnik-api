import { Migration } from '@mikro-orm/migrations';

export class Migration20260823164321 extends Migration {

  override name = 'Migration20260823164321';

  override up(): void | Promise<void> {
    this.addSql(`create table \`api_keys\` (\`id\` int unsigned not null auto_increment primary key, \`key\` varchar(255) not null, \`label\` varchar(255) null, \`created_at\` datetime not null, \`usage_count\` int not null default 0, \`revoked\` tinyint(1) not null default false, \`type\` int not null default 0) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`api_keys\` add unique \`api_keys_key_unique\` (\`key\`);`);

    this.addSql(`create table \`professors\` (\`id\` int unsigned not null auto_increment primary key, \`name\` varchar(255) not null) default character set utf8mb4 engine = InnoDB;`);

    this.addSql(`create table \`profmails\` (\`id\` int unsigned not null auto_increment primary key, \`email\` varchar(255) not null, \`prof_id\` int unsigned not null, \`hash\` varchar(255) not null) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`profmails\` add index \`profmails_prof_id_index\` (\`prof_id\`);`);

    this.addSql(`create table \`push_subscriptions\` (\`id\` int unsigned not null auto_increment primary key, \`endpoint\` text not null, \`endpoint_hash\` varchar(255) not null, \`p256dh\` varchar(255) not null, \`auth\` varchar(255) not null, \`mode\` varchar(255) not null, \`class_id\` int null, \`professor_id\` int null, \`subjects\` json null, \`groups\` json null, \`created_at\` datetime not null) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`push_subscriptions\` add unique \`push_subscriptions_endpoint_hash_unique\` (\`endpoint_hash\`);`);

    this.addSql(`create table \`classes\` (\`id\` int unsigned not null, \`name\` varchar(255) not null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);

    this.addSql(`create table \`mails\` (\`id\` int unsigned not null auto_increment primary key, \`email\` varchar(255) not null, \`class_id\` int unsigned not null, \`subjects\` json null, \`groups\` json null, \`hash\` varchar(255) not null) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`mails\` add index \`mails_class_id_index\` (\`class_id\`);`);

    this.addSql(`create table \`weeks\` (\`id\` int unsigned not null, \`label\` varchar(255) not null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);

    this.addSql(`create table \`timetables\` (\`id\` int unsigned not null auto_increment primary key, \`class_id\` int unsigned not null, \`week_id\` int unsigned not null, \`data\` json not null, \`hash\` varchar(255) not null) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`timetables\` add index \`timetables_class_id_index\` (\`class_id\`);`);
    this.addSql(`alter table \`timetables\` add index \`timetables_week_id_index\` (\`week_id\`);`);

    this.addSql(`alter table \`profmails\` add constraint \`profmails_prof_id_foreign\` foreign key (\`prof_id\`) references \`professors\` (\`id\`);`);

    this.addSql(`alter table \`mails\` add constraint \`mails_class_id_foreign\` foreign key (\`class_id\`) references \`classes\` (\`id\`);`);

    this.addSql(`alter table \`timetables\` add constraint \`timetables_class_id_foreign\` foreign key (\`class_id\`) references \`classes\` (\`id\`);`);
    this.addSql(`alter table \`timetables\` add constraint \`timetables_week_id_foreign\` foreign key (\`week_id\`) references \`weeks\` (\`id\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`profmails\` drop foreign key \`profmails_prof_id_foreign\`;`);
    this.addSql(`alter table \`mails\` drop foreign key \`mails_class_id_foreign\`;`);
    this.addSql(`alter table \`timetables\` drop foreign key \`timetables_class_id_foreign\`;`);
    this.addSql(`alter table \`timetables\` drop foreign key \`timetables_week_id_foreign\`;`);

    this.addSql(`drop table if exists \`api_keys\`;`);
    this.addSql(`drop table if exists \`professors\`;`);
    this.addSql(`drop table if exists \`profmails\`;`);
    this.addSql(`drop table if exists \`push_subscriptions\`;`);
    this.addSql(`drop table if exists \`classes\`;`);
    this.addSql(`drop table if exists \`mails\`;`);
    this.addSql(`drop table if exists \`weeks\`;`);
    this.addSql(`drop table if exists \`timetables\`;`);
  }

}

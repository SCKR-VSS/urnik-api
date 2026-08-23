import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { type Opt } from '@mikro-orm/core';

@Entity({ tableName: 'api_keys' })
export class ApiKey {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  key!: string;

  @Property({ nullable: true })
  label: string | null = null;

  @Property({ onCreate: () => new Date() })
  createdAt: Opt<Date> = new Date();

  @Property({ default: 0 })
  usageCount: Opt<number> = 0;

  @Property({ default: false })
  revoked: Opt<boolean> = false;

  @Property({ default: 0 })
  type: Opt<number> = 0;
}

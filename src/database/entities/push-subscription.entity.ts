import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { type Opt } from '@mikro-orm/core';

@Entity({ tableName: 'push_subscriptions' })
export class PushSubscription {
  @PrimaryKey()
  id!: number;

  @Property({ type: 'text' })
  endpoint!: string;

  @Property({ unique: true })
  endpointHash!: string;

  @Property()
  p256dh!: string;

  @Property()
  auth!: string;

  @Property()
  mode!: string;

  @Property({ nullable: true })
  classId: number | null = null;

  @Property({ nullable: true })
  professorId: number | null = null;

  @Property({ type: 'json', nullable: true })
  subjects: string[] | null = null;

  @Property({ type: 'json', nullable: true })
  groups: { name: string; group: number }[] | null = null;

  @Property({ onCreate: () => new Date() })
  createdAt: Opt<Date> = new Date();
}

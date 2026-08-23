import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { SchoolClass } from './school-class.entity';

@Entity({ tableName: 'mails' })
export class Mail {
  @PrimaryKey()
  id!: number;

  @Property()
  email!: string;

  @ManyToOne(() => SchoolClass, { fieldName: 'class_id' })
  schoolClass!: SchoolClass;

  @Property({ type: 'json', nullable: true })
  subjects: string[] | null = null;

  @Property({ type: 'json', nullable: true })
  groups: Record<string, number> | null = null;

  @Property()
  hash!: string;
}

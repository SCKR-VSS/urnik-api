import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { Professor } from './professor.entity';

@Entity({ tableName: 'profmails' })
export class Profmail {
  @PrimaryKey()
  id!: number;

  @Property()
  email!: string;

  @ManyToOne(() => Professor, { fieldName: 'prof_id' })
  professor!: Professor;

  @Property()
  hash!: string;
}

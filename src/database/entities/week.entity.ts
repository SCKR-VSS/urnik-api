import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'weeks' })
export class Week {
  @PrimaryKey({ autoincrement: false, type: Number })
  id!: number;

  @Property()
  label!: string;
}

import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'classes' })
export class SchoolClass {
  @PrimaryKey({ autoincrement: false, type: Number })
  id!: number;

  @Property()
  name!: string;
}

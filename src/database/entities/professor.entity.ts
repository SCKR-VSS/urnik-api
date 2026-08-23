import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'professors' })
export class Professor {
  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;
}

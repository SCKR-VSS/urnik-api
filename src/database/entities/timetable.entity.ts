import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { SchoolClass } from './school-class.entity';
import { Week } from './week.entity';

@Entity({ tableName: 'timetables' })
export class Timetable {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => SchoolClass, { fieldName: 'class_id' })
  schoolClass!: SchoolClass;

  @ManyToOne(() => Week, { fieldName: 'week_id' })
  week!: Week;

  @Property({ type: 'json' })
  data!: any;

  @Property()
  hash!: string;
}

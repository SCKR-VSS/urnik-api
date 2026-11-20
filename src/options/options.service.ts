import { Inject, Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mysql';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { SchoolClass } from 'src/database/entities/school-class.entity';
import { Week } from 'src/database/entities/week.entity';
import { Professor } from 'src/database/entities/professor.entity';
import { Timetable } from 'src/database/entities/timetable.entity';

export interface OptionsResponse {
  classes: any[];
  weeks: { value: number; label: string; isCurrent: boolean }[];
}

@Injectable()
export class OptionsService {
  constructor(
    private em: EntityManager,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getOptions(): Promise<OptionsResponse> {
    const cacheKey = 'options';
    const cachedOptions: OptionsResponse | undefined =
      await this.cacheManager.get(cacheKey);

    if (cachedOptions) {
      return cachedOptions;
    }

    const classes = await this.em.find(SchoolClass, {});

    const weeks: { value: number; label: string; isCurrent: boolean }[] = [];

    const weeksInDb = await this.em.find(Week, {});

    const currentDate = new Date();
    const weekday = currentDate.getDay();
    if (weekday === 6 || weekday === 0) {
      currentDate.setDate(currentDate.getDate() + (weekday === 6 ? 2 : 1));
      currentDate.setHours(0, 0, 0, 0);
    }

    for (const week of weeksInDb) {
      const parts = week.label.split('.').map((part) => parseInt(part, 10));
      const weekStartDate = new Date(parts[2], parts[1] - 1, parts[0]);

      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekEndDate.getDate() + 7);

      const isCurrent =
        currentDate >= weekStartDate && currentDate < weekEndDate;

      weeks.push({ value: week.id, label: week.label, isCurrent });
    }

    const professors = await this.em.find(Professor, {});

    const options = {
      classes,
      weeks,
      professors
    };

    await this.cacheManager.set(cacheKey, options);

    return options;
  }

  async getProfessors(): Promise<{ id: number; name: string }[]> {
    const cacheKey = 'professors';
    const cachedOptions: { id: number; name: string }[] | undefined =
      await this.cacheManager.get(cacheKey);

    if (cachedOptions) {
      return cachedOptions;
    }

    const professors = await this.em.find(Professor, {});

    await this.cacheManager.set(cacheKey, professors);

    return professors;
  }

  async getSubjects(classId: string): Promise<{ id: number; name: string }[]> {
    const cacheKey = `subjects_${classId}`;
    const cachedOptions: { id: number; name: string }[] | undefined =
      await this.cacheManager.get(cacheKey);

    if (cachedOptions) {
      return cachedOptions;
    }

    const classNum = parseInt(classId);
    if (isNaN(classNum) || classNum < 1) {
      return [];
    }

    const timetables = await this.em.find(Timetable, { schoolClass: classNum });

    const subjectSet = new Set<string>();

    timetables.forEach((entry) => {
      const data = entry.data;
      data.days.forEach((day: any) => {
        day.classes.forEach((cls: any) => {
          subjectSet.add(cls.subject.split(" ")[0]);
        });
      });
    });

    const subjectList = Array.from(subjectSet).map((subject, index) => ({
      id: index + 1,
      name: subject,
    }));

    await this.cacheManager.set(cacheKey, subjectList);

    return subjectList;
  }
}

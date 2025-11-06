import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

export interface OptionsResponse {
  classes: any[];
  weeks: { value: number; label: string; isCurrent: boolean }[];
}

@Injectable()
export class OptionsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getOptions(): Promise<OptionsResponse> {
    const cacheKey = 'options';
    const cachedOptions: OptionsResponse | undefined =
      await this.cacheManager.get(cacheKey);

    if (cachedOptions) {
      return cachedOptions;
    }

    const classes = await this.prisma.class.findMany();

    const weeks: { value: number; label: string; isCurrent: boolean }[] = [];

    const weeksInDb = await this.prisma.week.findMany();

    for (const week of weeksInDb) {
      const currentDate = new Date();
      const parts = week.label.split('.').map((part) => parseInt(part, 10));
      const weekStartDate = new Date(parts[2], parts[1] - 1, parts[0]);

      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekEndDate.getDate() + 7);

      const isCurrent =
        currentDate >= weekStartDate && currentDate < weekEndDate;

      weeks.push({ value: week.id, label: week.label, isCurrent });
    }

    const professors = await this.prisma.professor.findMany();

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

    const professors = await this.prisma.professor.findMany();

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

    const subjects = await this.prisma.timetable.findMany({
      where: {
        classId: classNum,
      },
    });

    const subjectSet = new Set<string>();

    subjects.forEach((entry) => {
      const data = JSON.parse(entry.data as string);
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

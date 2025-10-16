import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from '@nestjs/cache-manager';
import { parseTimetable } from './parseTimetable';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getTimetable(
    week: string,
    classId: string,
    skupine?: { [key: string]: number }[],
  ) {
    let bodyHash = '';
    if (skupine) {
      const bodyString = JSON.stringify(skupine);
      bodyHash = crypto.createHash('md5').update(bodyString).digest('hex');
    }

    const key = `timetable_${week}_${classId}_${bodyHash || 'default'}`;
    const weekNum = parseInt(week);
    const classNum = parseInt(classId);

    if (
      isNaN(weekNum) ||
      isNaN(classNum) ||
      weekNum < 1 ||
      weekNum > 53 ||
      classNum < 1
    ) {
      return { error: 'Invalid week or classId parameter' };
    }

    const paddedNum = classNum.toString().padStart(5, '0');
    const url = `https://sckr.si/vss/urniki/c/${week}/c${paddedNum}.htm`;

    const cachedData = await this.cacheManager.get(key);

    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch timetable: ${response.statusText}`);
      }

      const html = await response.text();

      const lastModified =
        response.headers.get('last-modified') || new Date().toUTCString();

      let updateTimestamp = '';

      if (lastModified) {
        try {
          const date = new Date(lastModified);
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const year = date.getFullYear();
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          updateTimestamp = `${day}.${month}.${year} ${hours}:${minutes}`;
        } catch (error) {
          console.error('Error parsing last-modified date:', error);
        }
      }

      const weekLabel = await this.prisma.week.findUnique({
        select: { label: true },
        where: { value: week },
      });

      const timetable = parseTimetable(html, weekLabel?.label || week);

      const result = { ...timetable, updateTimestamp };

      if (skupine === undefined) {
        await this.cacheManager.set(key, result);
        return result;
      }

      const filteredDays = timetable.days.map((day) => {
        const filteredClasses = day.classes.filter((cls) => {
          if (!cls.group) {
            return true;
          }
          return skupine.some(
            (skupina) => skupina && skupina[cls.subject] === cls.group,
          );
        });

        return { ...day, classes: filteredClasses };
      });

      const filteredTimetable = { ...timetable, days: filteredDays };

      const finalResult = { ...filteredTimetable, updateTimestamp };

      await this.cacheManager.set(key, finalResult);

      return { ...filteredTimetable, updateTimestamp };
    } catch (error) {
      console.error('Error fetching timetable:', error);
      return { error: 'Failed to fetch timetable data' };
    }
  }
}

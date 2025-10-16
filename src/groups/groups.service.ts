import { Injectable, Inject } from '@nestjs/common';
import { OptionsService } from 'src/options/options.service';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

interface Week {
  value: string;
  label: string;
}

@Injectable()
export class GroupsService {
  constructor(
    private optionsService: OptionsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getGroups(classId: string) {
    const key = `groups_${classId}`;
    const classNum = parseInt(classId);

    if (isNaN(classNum) || classNum < 1) {
      return { error: 'Invalid classId parameter' };
    }

    let weeks: Week[] = [];

    const options = await this.optionsService.getOptions();

    weeks = options.weeks;

    const subjectsMap = new Map<string, Set<number>>();
    const paddedNum = classNum.toString().padStart(5, '0');

    for (const week of weeks) {
      const url = `https://sckr.si/vss/urniki/c/${week.value}/c${paddedNum}.htm`;

      try {
        const html = await (await fetch(url)).text();

        if (html) {
          const lines = html.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const skupinaMatch = lines[i].match(/Skupina\s+(\d+)/i);
            if (skupinaMatch) {
              for (let j = i; j < Math.min(lines.length, i + 5); j++) {
                const subMatch = lines[j].match(/<B>([^<]+)<\/B>/i);
                if (subMatch) {
                  const subject = subMatch[1].trim();
                  const skupinaNum = parseInt(skupinaMatch[1], 10);

                  if (subject && subject.length > 1 && !/^\d+$/.test(subject)) {
                    if (!subjectsMap.has(subject)) {
                      subjectsMap.set(subject, new Set());
                    }
                    subjectsMap.get(subject)?.add(skupinaNum);
                    break;
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error fetching week ${week.value}:`, err.message);
      }
    }

    const result = Array.from(subjectsMap.entries()).map(
      ([subject, groups]) => ({
        subject,
        groups: Array.from(groups).sort((a, b) => a - b),
      }),
    );

    await this.cacheManager.set(key, result);

    return result;
  }
}

import slots from "src/constants/slots";

export function compareTimetablesForProfessor(
  oldData: any,
  newData: any,
  professorName: string,
): string {
  const changes: string[] = [];
  const oldClasses = new Map<string, any>();

  oldData.days.forEach((day: any, dayIndex: number) => {
    day.classes.forEach((cls: any) => {
      const key = `${dayIndex}-${cls.slot}-${cls.subject}`;
      oldClasses.set(key, cls);
    });
  });

  newData.days.forEach((day: any, dayIndex: number) => {
    day.classes.forEach((cls: any) => {
      const key = `${dayIndex}-${cls.slot}-${cls.subject}`;
      const oldCls = oldClasses.get(key);

      if (oldCls) {
        const isRelevant =
          oldCls.teacher?.includes(professorName) ||
          cls.teacher?.includes(professorName);

        if (isRelevant) {
          const modifications: string[] = [];
          if (oldCls.teacher !== cls.teacher) {
            modifications.push(
              `profesor iz <strong>${oldCls.teacher || 'N/A'}</strong> v <strong>${cls.teacher || 'N/A'}</strong>`,
            );
          }
          if (oldCls.classroom !== cls.classroom) {
            modifications.push(
              `učilnica iz <strong>${oldCls.classroom || 'N/A'}</strong> v <strong>${cls.classroom || 'N/A'}</strong>`,
            );
          }
          if (oldCls.group !== cls.group) {
            modifications.push(
              `skupina iz <strong>${oldCls.group || 'vse'}</strong> v <strong>${cls.group || 'vse'}</strong>`,
            );
          }

          if (modifications.length > 0) {
            const dayName = day.day.split(' ')[0];
            const startTime = slots[cls.slot]?.split(' ')[0] || '';
            changes.push(
              `<p><strong>${dayName} ob ${startTime} (${cls.subject}):</strong> sprememba za ${modifications.join(', ')}.</p>`,
            );
          }
        }
        oldClasses.delete(key);
      } else {
        if (cls.teacher?.includes(professorName)) {
          const dayName = day.day.split(' ')[0];
          const startTime = slots[cls.slot]?.split(' ')[0] || '';
          changes.push(
            `<p><strong>Dodan nov termin:</strong> ${cls.subject} v ${dayName} ob ${startTime} v učilnici ${cls.classroom}.</p>`,
          );
        }
      }
    });
  });

  oldClasses.forEach((cls) => {
    if (cls.teacher?.includes(professorName)) {
      const dayName = cls.dayName.split(' ')[0];
      const startTime = slots[cls.slot]?.split(' ')[0] || '';
      changes.push(
        `<p><strong>Odstranjen termin:</strong> ${cls.subject} v ${dayName} ob ${startTime}.</p>`,
      );
    }
  });

  return changes.join('');
}

export function compareTimetablesForPush(oldData: any, newData: any): string[] {
  const changes: string[] = [];
  const oldClasses = new Map<string, any>();

  oldData.days.forEach((day: any, dayIndex: number) => {
    day.classes.forEach((cls: any) => {
      const key = `${dayIndex}-${cls.slot}-${cls.subject}`;
      oldClasses.set(key, { ...cls, dayName: day.day });
    });
  });

  newData.days.forEach((day: any, dayIndex: number) => {
    day.classes.forEach((cls: any) => {
      const key = `${dayIndex}-${cls.slot}-${cls.subject}`;
      const oldCls = oldClasses.get(key);
      const dayName = day.day.split(' ')[0];
      const startTime = slots[cls.slot]?.split(' ')[0] || '';

      if (oldCls) {
        const modifications: string[] = [];
        if (oldCls.teacher !== cls.teacher) {
          modifications.push(`prof. ${oldCls.teacher || 'N/A'} → ${cls.teacher || 'N/A'}`);
        }
        if (oldCls.classroom !== cls.classroom) {
          modifications.push(`učilnica ${oldCls.classroom || 'N/A'} → ${cls.classroom || 'N/A'}`);
        }
        if (oldCls.group !== cls.group) {
          modifications.push(`skupina ${oldCls.group || 'vse'} → ${cls.group || 'vse'}`);
        }
        if (modifications.length > 0) {
          changes.push(`${cls.subject} (${dayName} ${startTime}): ${modifications.join(', ')}`);
        }
        oldClasses.delete(key);
      } else {
        changes.push(`${cls.subject} dodan (${dayName} ${startTime}, učilnica ${cls.classroom || 'N/A'})`);
      }
    });
  });

  oldClasses.forEach((cls) => {
    const dayName = cls.dayName.split(' ')[0];
    const startTime = slots[cls.slot]?.split(' ')[0] || '';
    changes.push(`${cls.subject} odstranjen (${dayName} ${startTime})`);
  });

  return changes;
}

export function compareTimetablesForProfessorPush(oldData: any, newData: any, professorName: string): string[] {
  const changes: string[] = [];
  const oldClasses = new Map<string, any>();

  oldData.days.forEach((day: any, dayIndex: number) => {
    day.classes.forEach((cls: any) => {
      const key = `${dayIndex}-${cls.slot}-${cls.subject}`;
      oldClasses.set(key, { ...cls, dayName: day.day });
    });
  });

  newData.days.forEach((day: any, dayIndex: number) => {
    day.classes.forEach((cls: any) => {
      const key = `${dayIndex}-${cls.slot}-${cls.subject}`;
      const oldCls = oldClasses.get(key);
      const dayName = day.day.split(' ')[0];
      const startTime = slots[cls.slot]?.split(' ')[0] || '';

      if (oldCls) {
        const isRelevant =
          oldCls.teacher?.includes(professorName) || cls.teacher?.includes(professorName);

        if (isRelevant) {
          const modifications: string[] = [];
          if (oldCls.teacher !== cls.teacher) {
            modifications.push(`prof. ${oldCls.teacher || 'N/A'} → ${cls.teacher || 'N/A'}`);
          }
          if (oldCls.classroom !== cls.classroom) {
            modifications.push(`učilnica ${oldCls.classroom || 'N/A'} → ${cls.classroom || 'N/A'}`);
          }
          if (oldCls.group !== cls.group) {
            modifications.push(`skupina ${oldCls.group || 'vse'} → ${cls.group || 'vse'}`);
          }
          if (modifications.length > 0) {
            changes.push(`${cls.subject} (${dayName} ${startTime}): ${modifications.join(', ')}`);
          }
        }
        oldClasses.delete(key);
      } else if (cls.teacher?.includes(professorName)) {
        changes.push(`${cls.subject} dodan (${dayName} ${startTime}, učilnica ${cls.classroom || 'N/A'})`);
      }
    });
  });

  oldClasses.forEach((cls) => {
    if (cls.teacher?.includes(professorName)) {
      const dayName = cls.dayName.split(' ')[0];
      const startTime = slots[cls.slot]?.split(' ')[0] || '';
      changes.push(`${cls.subject} odstranjen (${dayName} ${startTime})`);
    }
  });

  return changes;
}

export function compareTimetables(oldData: any, newData: any): string {
  const changes: string[] = [];
  const oldClasses = new Map<string, any>();

  oldData.days.forEach((day: any, dayIndex: number) => {
    day.classes.forEach((cls: any) => {
      const key = `${dayIndex}-${cls.slot}-${cls.subject}`;
      oldClasses.set(key, cls);
    });
  });

  newData.days.forEach((day: any, dayIndex: number) => {
    day.classes.forEach((cls: any) => {
      const key = `${dayIndex}-${cls.slot}-${cls.subject}`;
      const oldCls = oldClasses.get(key);

      if (oldCls) {
        const modifications: string[] = [];
        if (oldCls.teacher !== cls.teacher) {
          modifications.push(
            `profesor iz <strong>${oldCls.teacher || 'N/A'}</strong> v <strong>${cls.teacher || 'N/A'}</strong>`,
          );
        }
        if (oldCls.classroom !== cls.classroom) {
          modifications.push(
            `učilnica iz <strong>${oldCls.classroom || 'N/A'}</strong> v <strong>${cls.classroom || 'N/A'}</strong>`,
          );
        }
        if (oldCls.group !== cls.group) {
          modifications.push(
            `skupina iz <strong>${oldCls.group || 'vse'}</strong> v <strong>${cls.group || 'vse'}</strong>`,
          );
        }

        if (modifications.length > 0) {
          const dayName = day.day.split(' ')[0];
          const startTime = slots[cls.slot]?.split(' ')[0] || '';
          changes.push(
            `<p><strong>${dayName} ob ${startTime} (${cls.subject}):</strong> sprememba za ${modifications.join(', ')}.</p>`,
          );
        }
        oldClasses.delete(key);
      } else {
        const dayName = day.day.split(' ')[0];
        const startTime = slots[cls.slot]?.split(' ')[0] || '';
        changes.push(
          `<p><strong>Dodan nov termin:</strong> ${cls.subject} v ${dayName} ob ${startTime} v učilnici ${cls.classroom}.</p>`,
        );
      }
    });
  });

  oldClasses.forEach((cls) => {
    const dayName = cls.dayName.split(' ')[0];
    const startTime = slots[cls.slot]?.split(' ')[0] || '';
    changes.push(
      `<p><strong>Odstranjen termin:</strong> ${cls.subject} v ${dayName} ob ${startTime}.</p>`,
    );
  });

  return changes.join('');
}
import {
  calculateFastingDurationMinutes,
  getAverageFastingDurationMinutes,
  getFirstValidEatingTime,
  getWeeklyFastingSummary,
} from './fasting';

describe('fasting calculations', () => {
  it('calculates the first valid eating time after fifteen hours and one minute', () => {
    const startedAt = new Date(2026, 7, 17, 20, 0, 0).toISOString();

    expect(getFirstValidEatingTime(startedAt).toISOString()).toBe(
      new Date(2026, 7, 18, 11, 1, 0).toISOString(),
    );
  });

  it('summarizes the current local week by fasting start day', () => {
    const now = new Date(2026, 7, 21, 12, 0, 0);
    const mondayLongFastStartedAt = new Date(2026, 7, 17, 20, 0, 0).toISOString();
    const mondayShortFastStartedAt = new Date(2026, 7, 17, 8, 0, 0).toISOString();
    const tuesdayFastStartedAt = new Date(2026, 7, 18, 20, 0, 0).toISOString();

    const summary = getWeeklyFastingSummary(
      [
        {
          id: 'monday-long',
          startedAt: mondayLongFastStartedAt,
          endedAt: new Date(2026, 7, 18, 12, 1, 0).toISOString(),
          durationMinutes: 961,
        },
        {
          id: 'monday-short',
          startedAt: mondayShortFastStartedAt,
          endedAt: new Date(2026, 7, 17, 23, 0, 0).toISOString(),
          durationMinutes: 900,
        },
        {
          id: 'tuesday-cross-midnight',
          startedAt: tuesdayFastStartedAt,
          endedAt: new Date(2026, 7, 19, 11, 0, 0).toISOString(),
          durationMinutes: 900,
        },
      ],
      null,
      now,
    );

    expect(summary.map((day) => day.date)).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
    ]);
    expect(summary.map((day) => day.status)).toEqual([
      'success',
      'danger',
      'danger',
      'danger',
      'neutral',
      'neutral',
      'neutral',
    ]);
    expect(summary[0].durationMinutes).toBe(961);
    expect(summary[1].durationMinutes).toBe(900);
    expect(summary.slice(2).map((day) => day.durationMinutes)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it('marks an active fast in yellow and calculates its elapsed hours on demand', () => {
    const now = new Date(2026, 7, 21, 12, 30, 0);
    const summary = getWeeklyFastingSummary(
      [],
      { startedAt: new Date(2026, 7, 21, 8, 0, 0).toISOString() },
      now,
    );

    expect(summary[4]).toEqual({
      date: '2026-08-21',
      status: 'active',
      durationMinutes: 270,
    });
    expect(summary.slice(0, 4).every((day) => day.status === 'danger')).toBe(true);
    expect(summary.slice(5).every((day) => day.status === 'neutral')).toBe(true);
  });

  it('calculates elapsed minutes when a fast crosses midnight', () => {
    expect(
      calculateFastingDurationMinutes(
        '2026-08-17T22:30:00.000Z',
        '2026-08-18T00:30:00.000Z',
      ),
    ).toBe(120);
  });

  it('averages only completed fasting durations', () => {
    expect(
      getAverageFastingDurationMinutes([
        {
          id: 'fasting-1',
          startedAt: '2026-08-17T08:00:00.000Z',
          endedAt: '2026-08-17T10:00:00.000Z',
          durationMinutes: 120,
        },
        {
          id: 'fasting-2',
          startedAt: '2026-08-18T08:00:00.000Z',
          endedAt: '2026-08-18T09:00:00.000Z',
          durationMinutes: 60,
        },
      ]),
    ).toBe(90);
    expect(getAverageFastingDurationMinutes([])).toBeNull();
  });
});

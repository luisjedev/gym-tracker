import {
  calculateFastingDurationMinutes,
  getAverageFastingDurationMinutes,
} from './fasting';

describe('fasting calculations', () => {
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

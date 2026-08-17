/**
 * __tests__/utils/format.test.js
 * Tests for all pure utility functions in src/utils/format.js
 * These have zero native dependencies — zero mocking needed.
 */

import {
  formatDuration,
  dateGroupLabel,
  timeLabel,
  dateRangeForPreset,
  fullDateTimeLabel,
  groupByDate,
} from '../../src/utils/format';

// ─── formatDuration ───────────────────────────────────────────────────────────
describe('formatDuration', () => {
  it('formats zero as 00:00', () => {
    expect(formatDuration(0)).toBe('00:00');
  });

  it('formats 59 seconds correctly', () => {
    expect(formatDuration(59000)).toBe('00:59');
  });

  it('formats 1 minute correctly', () => {
    expect(formatDuration(60000)).toBe('01:00');
  });

  it('formats 1h 23m 45s correctly', () => {
    const ms = (1 * 3600 + 23 * 60 + 45) * 1000;
    expect(formatDuration(ms)).toBe('1:23:45');
  });

  it('omits hours when duration is under 1 hour', () => {
    expect(formatDuration(3599000)).toBe('59:59');
  });

  it('pads minutes and seconds with leading zeros', () => {
    expect(formatDuration(61000)).toBe('01:01');
  });
});

// ─── dateGroupLabel ───────────────────────────────────────────────────────────
describe('dateGroupLabel', () => {
  it('returns "Today" for a timestamp from today', () => {
    const now = Date.now();
    expect(dateGroupLabel(now, true)).toBe('Today');
  });

  it('returns "Yesterday" for a timestamp from yesterday', () => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    expect(dateGroupLabel(yesterday, true)).toBe('Yesterday');
  });

  it('returns a formatted date string when useRelative is false', () => {
    const now = Date.now();
    const result = dateGroupLabel(now, false);
    // Should NOT be 'Today', should be a formatted date string
    expect(result).not.toBe('Today');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── dateRangeForPreset ───────────────────────────────────────────────────────
describe('dateRangeForPreset', () => {
  it('returns [startOfToday, endOfToday] for "today"', () => {
    const [start, end] = dateRangeForPreset('today');
    const now = Date.now();
    expect(start).toBeLessThanOrEqual(now);
    expect(end).toBeGreaterThanOrEqual(now);
    // Start of day has 00:00:00 time
    const startDate = new Date(start);
    expect(startDate.getHours()).toBe(0);
    expect(startDate.getMinutes()).toBe(0);
  });

  it('returns [startOfYesterday, endOfYesterday] for "yesterday"', () => {
    const [start, end] = dateRangeForPreset('yesterday');
    expect(end - start).toBeCloseTo(24 * 60 * 60 * 1000 - 1, -3);
    // The end should be before today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    expect(end).toBeLessThan(startOfToday.getTime());
  });

  it('returns null for an unknown preset', () => {
    expect(dateRangeForPreset('unknownPreset')).toBeNull();
  });

  it('start is always less than end for all presets', () => {
    const presets = ['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth'];
    presets.forEach((preset) => {
      const [start, end] = dateRangeForPreset(preset);
      expect(start).toBeLessThan(end);
    });
  });
});

// ─── groupByDate ─────────────────────────────────────────────────────────────
describe('groupByDate', () => {
  const today = Date.now();
  const yesterday = today - 24 * 60 * 60 * 1000;

  const mockEntries = [
    { id: '1', updatedAt: today,     title: 'Entry A' },
    { id: '2', updatedAt: today,     title: 'Entry B' },
    { id: '3', updatedAt: yesterday, title: 'Entry C' },
  ];

  it('groups entries by date', () => {
    const sections = groupByDate(mockEntries);
    expect(sections.length).toBe(2);
  });

  it('puts two same-day entries in one section', () => {
    const sections = groupByDate(mockEntries);
    const todaySection = sections.find((s) => s.label === 'Today');
    expect(todaySection).toBeDefined();
    expect(todaySection.data.length).toBe(2);
  });

  it('puts yesterday entry in its own section', () => {
    const sections = groupByDate(mockEntries);
    const ystdSection = sections.find((s) => s.label === 'Yesterday');
    expect(ystdSection).toBeDefined();
    expect(ystdSection.data.length).toBe(1);
    expect(ystdSection.data[0].id).toBe('3');
  });

  it('returns empty array for empty input', () => {
    expect(groupByDate([])).toEqual([]);
  });
});

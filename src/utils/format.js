export function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function dateGroupLabel(timestamp, useRelative = true) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (useRelative) {
    if (isSameDay(date, today)) return 'Today';
    if (isSameDay(date, yesterday)) return 'Yesterday';
  }
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function timeLabel(timestamp) {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// Returns [startMs, endMs] (inclusive) for a named date-range preset.
export function dateRangeForPreset(preset) {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
  const dayOfWeek = now.getDay(); // 0 = Sunday

  switch (preset) {
    case 'today':
      return [startOfDay(now), endOfDay(now)];
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      return [startOfDay(y), endOfDay(y)];
    }
    case 'thisWeek': {
      const start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek);
      return [startOfDay(start), endOfDay(now)];
    }
    case 'lastWeek': {
      const end = new Date(now);
      end.setDate(now.getDate() - dayOfWeek - 1);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      return [startOfDay(start), endOfDay(end)];
    }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return [startOfDay(start), endOfDay(now)];
    }
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return [startOfDay(start), endOfDay(end)];
    }
    default:
      return null;
  }
}

// "19 Jul 2026, 5:48 PM" - used per-row in edit/selection mode instead of relative labels.
export function fullDateTimeLabel(timestamp) {
  const date = new Date(timestamp);
  const datePart = date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  return `${datePart}, ${timeLabel(timestamp)}`;
}

// Groups entries (already sorted newest-first) into { label, data } sections for a SectionList.
// Pass useRelativeDates=false (edit mode) to always show absolute "DD Mon YYYY" labels.
export function groupByDate(entries, useRelativeDates = true) {
  const sections = [];
  let lastLabel = null;
  for (const entry of entries) {
    const label = dateGroupLabel(entry.updatedAt, useRelativeDates);
    if (label !== lastLabel) {
      sections.push({ label, data: [entry] });
      lastLabel = label;
    } else {
      sections[sections.length - 1].data.push(entry);
    }
  }
  return sections;
}

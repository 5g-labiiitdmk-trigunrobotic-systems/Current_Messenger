// FILE PURPOSE: Shared by chat/[id].tsx and group-chat/[id].tsx's inverted
// message lists — both need the exact same "which calendar day is this
// message on, and what should the separator between two different days say"
// logic, so it lives here once instead of being duplicated per screen.

// Groups a timestamp into a same-calendar-day bucket key (local time).
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Human-readable label for a date separator row: "Today"/"Yesterday" for
// the two most recent days, otherwise a locale-formatted date (year
// omitted when it's the current year).
export function dateSeparatorLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString([], sameYear ? { month: 'long', day: 'numeric' } : { month: 'long', day: 'numeric', year: 'numeric' });
}

export interface DateSeparatorRow {
  id: string;
  kind: 'date-separator';
  label: string;
}

/**
 * Interleaves date-separator rows into an already-newest-first
 * (inverted-list-ready) array of items, each of which must expose
 * `id` and `sentAt`. A separator for a given day is inserted
 * immediately after that day's oldest message in the array (i.e. right
 * before the transition to the next older day, or at the very end) —
 * since index 0 renders at the visual bottom in an inverted FlatList
 * and increasing index renders further up, this makes each separator
 * appear just above the first (chronologically earliest) message of
 * its day when read top-to-bottom.
 */
export function withDateSeparators<T extends { id: string; sentAt: string }>(newestFirst: T[]): (T | DateSeparatorRow)[] {
  const rows: (T | DateSeparatorRow)[] = [];
  for (let i = 0; i < newestFirst.length; i++) {
    const m = newestFirst[i];
    rows.push(m);
    const next = newestFirst[i + 1];
    if (!next || dayKey(next.sentAt) !== dayKey(m.sentAt)) {
      rows.push({ id: `date-sep-${dayKey(m.sentAt)}-${m.id}`, kind: 'date-separator', label: dateSeparatorLabel(m.sentAt) });
    }
  }
  return rows;
}

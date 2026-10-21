import type { ReleaseWindow } from '../api/types';

export interface ReleaseNoticeText {
  title: string;
  body: string;
}

/** "Oct 13, 2026" from "2026-10-13" (UTC, so the day never shifts); null when unparseable. */
function pretty(day: string | null | undefined): string | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** Player message for movies with no stream because they are still in (or not yet in) cinemas. */
export function releaseNotice(window: ReleaseWindow | null | undefined, name: string): ReleaseNoticeText | null {
  if (window?.status === 'in_theaters') {
    const digital = pretty(window.digitalDate);
    return {
      title: 'In cinemas now',
      body: digital
        ? `${name} is only showing in cinemas. It should be available to stream from ${digital}.`
        : `${name} is only showing in cinemas. It will be available here once it is released online.`,
    };
  }
  if (window?.status === 'upcoming') {
    const opens = pretty(window.theatricalDate);
    return {
      title: 'Coming soon',
      body: opens ? `${name} opens in cinemas on ${opens}.` : `${name} hasn't been released yet.`,
    };
  }
  return null;
}

import { format } from 'date-fns'
import type { ContentPillar, ScheduledPost } from '../types'
import { downloadFile } from './ui'

function csvCell(v: string): string {
  return `"${(v || '').replace(/"/g, '""')}"`
}

export function exportCsv(posts: ScheduledPost[], pillars: ContentPillar[]) {
  const headers = ['Date', 'Platforms', 'Pillar', 'Title', 'Hook', 'Caption', 'CTA', 'Hashtags', 'Email Subject', 'Status']
  const rows = [...posts]
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    .map((p) =>
      [
        p.scheduledDate,
        p.platforms.join(' / '),
        pillars.find((x) => x.id === p.pillarId)?.title || '',
        p.title,
        p.hook,
        p.caption,
        p.cta,
        p.hashtags,
        p.emailSubject,
        p.status,
      ]
        .map(csvCell)
        .join(','),
    )
  downloadFile('valmer-content-plan.csv', [headers.join(','), ...rows].join('\n'), 'text/csv')
}

export function exportIcs(posts: ScheduledPost[], pillars: ContentPillar[]) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Valmer//Storyboard//EN']
  for (const p of posts) {
    const d = p.scheduledDate.replace(/-/g, '')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${p.id}@valmer`,
      `DTSTART;VALUE=DATE:${d}`,
      `SUMMARY:${(pillars.find((x) => x.id === p.pillarId)?.title || 'Post')}: ${p.title}`,
      `DESCRIPTION:${(p.caption || '').replace(/\n/g, '\\n')}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  downloadFile('valmer-content-plan.ics', lines.join('\r\n'), 'text/calendar')
}

export function copyWeekCaptions(posts: ScheduledPost[]): string {
  return [...posts]
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    .map((p) => `${format(new Date(p.scheduledDate), 'EEE MMM d')} · ${p.platforms.join('/')}\n${p.caption}\n${p.hashtags}`.trim())
    .join('\n\n———\n\n')
}

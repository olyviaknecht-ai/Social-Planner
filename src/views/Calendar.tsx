import { useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useStore } from '../store/useStore'
import type { ScheduledPost } from '../types'
import { cls } from '../lib/ui'
import { exportCsv, exportIcs, copyWeekCaptions } from '../lib/export'
import Thumbnail from '../components/Thumbnail'
import { PlatformBadge, StatusBadge } from '../components/Badges'
import PostEditor from '../components/PostEditor'
import PageHeader from '../components/PageHeader'

export default function Calendar() {
  const { posts, pillars, weeks, assets, updatePost, addPost, removePost, clearPosts, generatePlan } = useStore()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [dragId, setDragId] = useState<string | null>(null)
  const [openPost, setOpenPost] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()))

  const postsByDate = useMemo(() => {
    const m = new Map<string, ScheduledPost[]>()
    for (const p of posts) {
      if (!m.has(p.scheduledDate)) m.set(p.scheduledDate, [])
      m.get(p.scheduledDate)!.push(p)
    }
    return m
  }, [posts])

  // Build the visible month grid (full weeks, Monday-first) from real dates.
  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
    const days: Date[] = []
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
    return days
  }, [cursor])

  const weekRows = useMemo(() => {
    const rows: Date[][] = []
    for (let i = 0; i < gridDays.length; i += 7) rows.push(gridDays.slice(i, i + 7))
    return rows
  }, [gridDays])

  const monthCount = posts.filter((p) => isSameMonth(parseISO(p.scheduledDate), cursor)).length

  const phaseForDate = (date: string): number => {
    const wk = weeks.find((w) => date >= w.weekStart && date <= w.weekEnd)
    return wk?.phase ?? 1
  }

  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null)
    if (e.over) updatePost(String(e.active.id), { scheduledDate: String(e.over.id), status: 'scheduled' })
  }

  const dragPost = posts.find((p) => p.id === dragId)

  return (
    <div className="p-6">
      <PageHeader
        title="Calendar"
        subtitle="Your posts on real dates. Drag to reschedule, click to edit. Default cadence is 3 posts a week."
        action={
          <div className="flex gap-2">
            {posts.length === 0 && <button onClick={generatePlan} className="btn-primary">Generate plan</button>}
            {posts.length > 0 && (
              <button
                onClick={() => { if (confirm(`Clear all ${posts.length} posts from the calendar? Your photos stay in the library.`)) clearPosts() }}
                className="btn-outline text-rose-600 hover:bg-rose-50"
              >
                Clear calendar
              </button>
            )}
            <div className="relative">
              <button onClick={() => setExportOpen((v) => !v)} className="btn-outline">Export ▾</button>
              {exportOpen && (
                <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-black/10 bg-white py-1 shadow-lg">
                  <MenuItem onClick={() => { exportCsv(posts, pillars); setExportOpen(false) }}>Download CSV</MenuItem>
                  <MenuItem onClick={() => { exportIcs(posts, pillars); setExportOpen(false) }}>Calendar (.ics)</MenuItem>
                  <MenuItem onClick={() => { navigator.clipboard.writeText(copyWeekCaptions(posts)); setCopied(true); setTimeout(() => setCopied(false), 1500); setExportOpen(false) }}>
                    Copy all captions
                  </MenuItem>
                </div>
              )}
            </div>
          </div>
        }
      />

      {/* Month navigation */}
      <div className="mb-3 flex items-center gap-3">
        <button onClick={() => setCursor((c) => subMonths(c, 1))} className="btn-outline px-2.5 py-1">‹</button>
        <div className="min-w-[180px] text-center font-serif text-lg text-valmer-ink">{format(cursor, 'MMMM yyyy')}</div>
        <button onClick={() => setCursor((c) => addMonths(c, 1))} className="btn-outline px-2.5 py-1">›</button>
        <button onClick={() => setCursor(startOfMonth(new Date()))} className="btn-ghost px-2 py-1 text-sm">Today</button>
        <span className="ml-auto text-xs text-valmer-slate/50">{monthCount} post{monthCount === 1 ? '' : 's'} this month · {posts.length} total</span>
      </div>

      {copied && <div className="mb-3 text-sm text-valmer-sage">Captions copied to clipboard.</div>}

      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))} onDragEnd={onDragEnd}>
        <div className="space-y-2">
          <div className="grid grid-cols-7 gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-valmer-slate/50">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          {weekRows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-7 gap-2">
              {row.map((d) => {
                const date = format(d, 'yyyy-MM-dd')
                return (
                  <DayCell
                    key={date}
                    date={date}
                    inMonth={isSameMonth(d, cursor)}
                    today={isToday(d)}
                    posts={postsByDate.get(date) || []}
                    pillars={pillars}
                    assets={assets}
                    onAdd={() => { const id = addPost({ scheduledDate: date, phase: phaseForDate(date), title: 'New post' }); setOpenPost(id) }}
                    onOpen={setOpenPost}
                    onDuplicate={(p) => addPost({ ...p, id: undefined as any, title: p.title + ' (copy)' })}
                    onDelete={removePost}
                  />
                )
              })}
            </div>
          ))}
        </div>

        <DragOverlay>
          {dragPost && (
            <div className="card p-2 shadow-lg">
              <div className="text-xs font-medium">{dragPost.title}</div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {openPost && <PostEditor postId={openPost} onClose={() => setOpenPost(null)} />}
    </div>
  )
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5">
      {children}
    </button>
  )
}

function DayCell({
  date,
  posts,
  pillars,
  assets,
  inMonth,
  today,
  onAdd,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  date: string
  posts: ScheduledPost[]
  pillars: ReturnType<typeof useStore.getState>['pillars']
  assets: ReturnType<typeof useStore.getState>['assets']
  inMonth: boolean
  today: boolean
  onAdd: () => void
  onOpen: (id: string) => void
  onDuplicate: (p: ScheduledPost) => void
  onDelete: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date })
  const dayNum = date.slice(8)
  return (
    <div
      ref={setNodeRef}
      className={cls(
        'group min-h-[120px] rounded-lg border p-1.5 transition-colors',
        isOver ? 'border-valmer-sage bg-valmer-sage/10' : today ? 'border-valmer-clay/50 bg-valmer-clay/5' : 'border-black/5 bg-white/60',
        !inMonth && 'opacity-45',
      )}
    >
      <div className="mb-1 flex items-center justify-between px-0.5">
        <span className={cls('text-[11px] font-medium', today ? 'flex h-5 w-5 items-center justify-center rounded-full bg-valmer-clay text-white' : 'text-valmer-slate/60')}>
          {Number(dayNum)}
        </span>
        <button onClick={onAdd} className="text-valmer-slate/30 opacity-0 transition-opacity group-hover:opacity-100 hover:text-valmer-slate">+</button>
      </div>
      <div className="space-y-1.5">
        {posts.map((p) => {
          const pillar = pillars.find((x) => x.id === p.pillarId)
          const asset = assets.find((a) => p.assetIds.includes(a.id))
          return <PostCard key={p.id} post={p} pillar={pillar} asset={asset} onOpen={() => onOpen(p.id)} onDuplicate={() => onDuplicate(p)} onDelete={() => onDelete(p.id)} />
        })}
      </div>
    </div>
  )
}

function PostCard({ post, pillar, asset, onOpen, onDuplicate, onDelete }: { post: ScheduledPost; pillar: any; asset: any; onOpen: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: post.id })
  const isCarousel = post.format === 'carousel' || post.assetIds.length > 1
  return (
    <div
      ref={setNodeRef}
      className={cls('rounded-md border border-black/5 bg-white shadow-sm', isDragging && 'opacity-30')}
      style={{ borderLeft: `3px solid ${pillar?.color || '#cbd5e1'}` }}
    >
      <div {...attributes} {...listeners} onClick={onOpen} className="cursor-pointer p-1.5 active:cursor-grabbing" title="Click to view details">
        <div className="flex gap-1.5">
          {asset && <Thumbnail asset={asset} className="h-8 w-8 shrink-0 rounded" />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-medium leading-tight text-valmer-ink">{post.title}</div>
            <div className="mt-0.5 flex flex-wrap gap-0.5">
              {post.platforms.slice(0, 2).map((pl) => (
                <PlatformBadge key={pl} platform={pl} />
              ))}
              {isCarousel && <span className="chip bg-valmer-gold/20 text-[9px] text-valmer-gold">carousel {post.assetIds.length}</span>}
              {post.optional && <span className="chip bg-valmer-gold/20 text-[9px] text-valmer-gold">extra</span>}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-black/5 px-1.5 py-1">
        <button onClick={onOpen} className="text-[10px] text-valmer-sage hover:underline">edit</button>
        <button onClick={onDuplicate} className="text-[10px] text-valmer-slate/40 hover:text-valmer-slate">dup</button>
        <button onClick={onDelete} className="text-[10px] text-valmer-slate/40 hover:text-rose-500" title="Delete post">del</button>
        <StatusBadge status={post.status} />
      </div>
    </div>
  )
}

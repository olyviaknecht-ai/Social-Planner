import { useState } from 'react'
import { addDays, differenceInCalendarDays, format } from 'date-fns'
import { useStore } from '../store/useStore'
import { CAMPAIGN_STAGES, CAMPAIGN_TEMPLATES } from '../data/seed'
import type { Campaign } from '../types'
import PageHeader from '../components/PageHeader'
import Thumbnail from '../components/Thumbnail'
import PostEditor from '../components/PostEditor'
import { cls } from '../lib/ui'

// Keywords per campaign stage — matched against THIS brand's pillar titles so
// campaigns use whatever pillars the brand actually has.
const STAGE_KEYWORDS: Record<string, string[]> = {
  Tease: ['people', 'face', 'team', 'behind'],
  'Explain value': ['education', 'tip', 'value', 'growth', 'tool', 'service'],
  'Show proof': ['proof', 'review', 'testimonial', 'result'],
  'Show people/faces': ['people', 'face', 'team'],
  'Invite/register': ['event', 'offer', 'launch'],
  Reminder: ['event', 'offer'],
  'Last call': ['event', 'offer'],
  Recap: ['proof', 'review', 'community', 'event'],
  'Follow-up/resource': ['education', 'tip', 'tool', 'value'],
}
function stagePillarId(stage: string, pillars: { id: string; title: string }[]): string | undefined {
  const keys = STAGE_KEYWORDS[stage] || []
  const match = pillars.find((p) => keys.some((k) => p.title.toLowerCase().includes(k)))
  return (match || pillars[0])?.id
}

export default function Campaigns() {
  const { campaigns, assets, pillars, posts, addCampaign, updateCampaign, removeCampaign, addPost, updateAsset } = useStore()
  const [selected, setSelected] = useState<string | null>(null)
  const [openPost, setOpenPost] = useState<string | null>(null)
  const campaign = campaigns.find((c) => c.id === selected)

  const createCampaign = (title: string) => {
    const id = addCampaign({
      title,
      goal: '',
      beats: CAMPAIGN_STAGES.map((stage, i) => ({ id: `beat-${i}`, stage, description: '', assetIds: [] })),
    })
    setSelected(id)
  }

  const generateSequence = (c: Campaign) => {
    const span = Math.max(8, differenceInCalendarDays(new Date(c.endDate), new Date(c.startDate)))
    const step = span / (c.beats.length - 1 || 1)
    c.beats.forEach((beat, i) => {
      if (beat.postId) return
      const date = format(addDays(new Date(c.startDate), Math.round(step * i)), 'yyyy-MM-dd')
      const pillarId = stagePillarId(beat.stage, pillars)
      const asset = assets.find((a) => beat.assetIds.includes(a.id))
      const id = addPost({
        scheduledDate: date,
        title: `${c.title}: ${beat.stage}`,
        pillarId,
        campaignId: c.id,
        assetIds: asset ? [asset.id] : [],
        platforms: asset?.selectedPlatforms?.length ? asset.selectedPlatforms : ['instagram', 'facebook'],
        status: 'idea',
        notes: `Campaign beat: ${beat.stage}`,
        optional: true,
      })
      const newBeats = c.beats.map((b) => (b.id === beat.id ? { ...b, postId: id } : b))
      updateCampaign(c.id, { beats: newBeats, status: 'active' })
    })
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Campaigns"
        subtitle="Build a sequence for a major initiative: tease, value, proof, faces, invite, reminder, last call, recap, follow-up."
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-3">
          <div className="card p-4">
            <div className="mb-2 text-sm font-semibold text-valmer-slate">Start a campaign</div>
            <div className="flex flex-wrap gap-1.5">
              {CAMPAIGN_TEMPLATES.map((t) => (
                <button key={t} onClick={() => createCampaign(t)} className="chip border border-black/10 text-valmer-slate hover:bg-black/5">
                  + {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {campaigns.length === 0 && <div className="text-sm text-valmer-slate/50">No campaigns yet.</div>}
            {campaigns.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={cls('card flex w-full items-center justify-between p-3 text-left', selected === c.id && 'ring-2 ring-valmer-sage')}
              >
                <div>
                  <div className="font-medium text-valmer-ink">{c.title}</div>
                  <div className="text-xs text-valmer-slate/50">{c.beats.filter((b) => b.postId).length}/{c.beats.length} beats placed</div>
                </div>
                <span className={cls('chip', c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>{c.status}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-2">
          {!campaign ? (
            <div className="card flex h-full items-center justify-center p-12 text-center text-valmer-slate/50">
              Pick a campaign or start one from a template.
            </div>
          ) : (
            <div className="card p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <input value={campaign.title} onChange={(e) => updateCampaign(campaign.id, { title: e.target.value })} className="w-full bg-transparent font-serif text-xl outline-none" />
                  <input value={campaign.goal} onChange={(e) => updateCampaign(campaign.id, { goal: e.target.value })} placeholder="What's the goal of this campaign?" className="mt-1 w-full bg-transparent text-sm text-valmer-slate/70 outline-none" />
                  <div className="mt-2 flex gap-2">
                    <input type="date" value={campaign.startDate} onChange={(e) => updateCampaign(campaign.id, { startDate: e.target.value })} className="input w-40 py-1" />
                    <span className="self-center text-valmer-slate/40">→</span>
                    <input type="date" value={campaign.endDate} onChange={(e) => updateCampaign(campaign.id, { endDate: e.target.value })} className="input w-40 py-1" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => generateSequence(campaign)} className="btn-primary">Place sequence</button>
                  <button onClick={() => { removeCampaign(campaign.id); setSelected(null) }} className="btn text-rose-600 hover:bg-rose-50">Delete</button>
                </div>
              </div>

              <div className="space-y-2">
                {campaign.beats.map((beat, i) => {
                  const pillar = pillars.find((p) => p.id === stagePillarId(beat.stage, pillars))
                  const beatAssets = assets.filter((a) => beat.assetIds.includes(a.id))
                  const post = posts.find((p) => p.id === beat.postId)
                  return (
                    <div key={beat.id} className="flex items-start gap-3 rounded-lg border border-black/5 bg-white p-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-valmer-slate text-xs font-semibold text-white">{i + 1}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-valmer-ink">{beat.stage}</span>
                          {pillar && <span className="chip text-[10px]" style={{ backgroundColor: pillar.color + '22', color: pillar.color }}>{pillar.title}</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {beatAssets.map((a) => (
                            <div key={a.id} className="relative">
                              <Thumbnail asset={a} className="h-9 w-9 rounded" />
                              <button onClick={() => updateCampaign(campaign.id, { beats: campaign.beats.map((b) => b.id === beat.id ? { ...b, assetIds: b.assetIds.filter((x) => x !== a.id) } : b) })} className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white text-[10px] shadow">✕</button>
                            </div>
                          ))}
                          <AttachAsset
                            assets={assets.filter((a) => !beat.assetIds.includes(a.id) && a.status !== 'unusable')}
                            onPick={(aid) => {
                              updateCampaign(campaign.id, { beats: campaign.beats.map((b) => b.id === beat.id ? { ...b, assetIds: [...b.assetIds, aid] } : b) })
                              updateAsset(aid, { campaignId: campaign.id })
                            }}
                          />
                        </div>
                      </div>
                      {post ? (
                        <button onClick={() => setOpenPost(post.id)} className="btn-outline py-1 text-xs">{format(new Date(post.scheduledDate), 'MMM d')} · edit</button>
                      ) : (
                        <span className="chip bg-gray-100 text-[10px] text-gray-500">not placed</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {openPost && <PostEditor postId={openPost} onClose={() => setOpenPost(null)} />}
    </div>
  )
}

function AttachAsset({ assets, onPick }: { assets: ReturnType<typeof useStore.getState>['assets']; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="h-9 w-9 rounded border-2 border-dashed border-black/15 text-lg text-valmer-slate/40">+</button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-48 w-56 overflow-auto rounded-lg border border-black/10 bg-white p-1 shadow-lg">
          {assets.length === 0 && <div className="p-2 text-xs text-valmer-slate/50">No assets available.</div>}
          {assets.map((a) => (
            <button key={a.id} onClick={() => { onPick(a.id); setOpen(false) }} className="flex w-full items-center gap-2 rounded p-1 text-left text-xs hover:bg-black/5">
              <Thumbnail asset={a} className="h-7 w-7 rounded" />
              <span className="truncate">{a.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

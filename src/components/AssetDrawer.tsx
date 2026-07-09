import { useState } from 'react'
import { useStore } from '../store/useStore'
import { PLATFORMS } from '../types'
import type { Platform } from '../types'
import { repurposeIdeas } from '../engine/strategy'
import { generateCaption } from '../engine/caption'
import { aiGenerateCaption, aiReady } from '../engine/ai'
import { cls } from '../lib/ui'
import Thumbnail from './Thumbnail'
import Lightbox from './Lightbox'
import { PillarBadge } from './Badges'

export default function AssetDrawer({ assetId, onClose, onOpenPost }: { assetId: string; onClose: () => void; onOpenPost: (id: string) => void }) {
  const { assets, pillars, campaigns, folders, people, aiConfig, brands, activeBrandId, brief, voice, updateAsset, removeAsset, reanalyzeAsset, addPost } = useStore()
  const activeBrand = brands.find((b) => b.id === activeBrandId)
  const asset = assets.find((a) => a.id === assetId)
  const [busy, setBusy] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [reanalyzed, setReanalyzed] = useState(false)
  if (!asset) return null
  const set = (patch: Partial<typeof asset>) => updateAsset(asset.id, patch)
  const analysis = asset.analysis
  const pillar = pillars.find((p) => p.id === asset.selectedPillarId)
  const useAI = aiReady(aiConfig)

  const togglePlatform = (pl: Platform) =>
    set({ selectedPlatforms: asset.selectedPlatforms.includes(pl) ? asset.selectedPlatforms.filter((x) => x !== pl) : [...asset.selectedPlatforms, pl] })

  const createPostFromAsset = async () => {
    setBusy(true)
    let gen = generateCaption(asset, pillar, { people })
    if (useAI) {
      try {
        gen = await aiGenerateCaption(aiConfig, { asset, pillar, people, brand: activeBrand ? { name: activeBrand.name, brief, voice } : undefined })
      } catch {
        // fall back to built-in writer on any AI failure
      }
    }
    const id = addPost({
      title: asset.title,
      assetIds: [asset.id],
      pillarId: asset.selectedPillarId,
      campaignId: asset.campaignId,
      platforms: asset.selectedPlatforms.length ? asset.selectedPlatforms : asset.suggestedPlatforms,
      caption: gen.caption,
      hook: gen.hook,
      cta: gen.cta,
      hashtags: gen.hashtags,
      status: 'drafted',
    })
    set({ status: 'scheduled' })
    setBusy(false)
    onOpenPost(id)
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-auto bg-valmer-mist shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white px-5 py-3">
          <div className="font-serif text-lg">Asset detail</div>
          <button onClick={onClose} className="btn-ghost px-2">✕</button>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex gap-4">
            <button onClick={() => setLightbox(true)} className="group relative h-32 w-32 shrink-0 overflow-hidden rounded-xl" title={asset.fileType === 'video' ? 'Play' : 'Enlarge'}>
              <Thumbnail asset={asset} className="h-32 w-32" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                <span className="text-2xl">{asset.fileType === 'video' ? '▶' : '⤢'}</span>
              </span>
            </button>
            <div className="flex-1 space-y-2">
              <input value={asset.title} onChange={(e) => set({ title: e.target.value })} className="input font-medium" />
              <div className="flex items-center gap-2">
                <PillarBadge pillar={pillar} />
                <span className={cls('chip', asset.status === 'unusable' ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-600')}>{asset.status}</span>
              </div>
            </div>
          </div>

          {/* AI analysis */}
          {analysis && (
            <div className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-serif text-valmer-slate">Strategist read</div>
                <button
                  onClick={() => {
                    reanalyzeAsset(asset.id)
                    setReanalyzed(true)
                    setTimeout(() => setReanalyzed(false), 1800)
                  }}
                  className={cls('py-1 text-xs', reanalyzed ? 'chip bg-valmer-sage/15 text-valmer-sage' : 'btn-outline')}
                >
                  {reanalyzed ? '✓ Updated from your notes' : 'Re-analyze'}
                </button>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <Row k="Content type" v={analysis.contentType} />
                <Row k="Format" v={analysis.format} />
                <Row k="Business goal" v={analysis.businessGoal} />
                <Row k="Lead vs support" v={analysis.canLead ? 'Strong enough to lead' : 'Better as support'} />
                <Row k="Timing" v={analysis.evergreen ? 'Evergreen' : 'Time-sensitive'} />
                <Row k="Needs context?" v={analysis.needsContext ? 'Yes, add a note' : 'No'} />
              </dl>
              <p className="mt-2 text-sm text-valmer-slate/80"><span className="font-medium">Emotional angle:</span> {analysis.emotionalAngle}</p>
              <p className="mt-1 text-sm text-valmer-slate/80"><span className="font-medium">Caption direction:</span> {analysis.captionDirection}</p>
              <p className="mt-1 text-sm text-valmer-slate/80"><span className="font-medium">Suggested CTA:</span> {analysis.cta}</p>
              {analysis.campaignSuggestion && (
                <p className="mt-1 text-sm text-valmer-clay">Possible campaign: {analysis.campaignSuggestion}</p>
              )}
            </div>
          )}

          {/* Pillar + platforms override */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Pillar (override)</label>
              <select value={asset.selectedPillarId || ''} onChange={(e) => set({ selectedPillarId: e.target.value || undefined })} className="input">
                <option value="">None</option>
                {pillars.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              {asset.suggestedPillars.length > 0 && (
                <div className="mt-1 text-[11px] text-valmer-slate/50">
                  Suggested: {asset.suggestedPillars.map((id) => pillars.find((p) => p.id === id)?.title).filter(Boolean).join(', ')}
                </div>
              )}
            </div>
            <div>
              <label className="label">Campaign</label>
              <select value={asset.campaignId || ''} onChange={(e) => set({ campaignId: e.target.value || undefined })} className="input">
                <option value="">None</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Folder</label>
              <select value={asset.folderId || ''} onChange={(e) => set({ folderId: e.target.value || undefined })} className="input">
                <option value="">Unfiled</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((pl) => (
                <button key={pl.id} onClick={() => togglePlatform(pl.id)} className={cls('chip border', asset.selectedPlatforms.includes(pl.id) ? 'bg-valmer-slate text-white border-valmer-slate' : 'border-black/15 text-valmer-slate')}>
                  {pl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Metadata / manual notes */}
          <div className="card p-4 space-y-3">
            <div className="font-serif text-valmer-slate">Context</div>
            <div>
              <label className="label">Who is in this?</label>
              <input
                list="known-people"
                value={asset.people}
                onChange={(e) => set({ people: e.target.value })}
                placeholder={people.length ? 'Start typing a name…' : 'Add people in the People directory to name them in captions'}
                className="input"
              />
              <datalist id="known-people">
                {people.filter((p) => p.name).map((p) => (
                  <option key={p.id} value={p.name}>{p.role}</option>
                ))}
              </datalist>
              {asset.people.trim() && people.some((p) => p.name && asset.people.toLowerCase().includes(p.name.toLowerCase())) && (
                <div className="mt-1 text-[11px] text-valmer-sage">Recognized from your People directory — captions will use their role.</div>
              )}
            </div>
            <Field label="What event / topic?" value={asset.event} onChange={(v) => set({ event: v })} />
            <Field label="Location" value={asset.location} onChange={(v) => set({ location: v })} />
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={asset.timeSensitive} onChange={(e) => set({ timeSensitive: e.target.checked })} />
                Time-sensitive
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={asset.hasCta} onChange={(e) => set({ hasCta: e.target.checked })} />
                Has a CTA
              </label>
            </div>
            {asset.timeSensitive && (
              <Field label="Expiration date" type="date" value={asset.expirationDate || ''} onChange={(v) => set({ expirationDate: v })} />
            )}
            <Field label="CTA / service or event to mention" value={asset.ctaNote} onChange={(v) => set({ ctaNote: v })} />
            <Field label="People / businesses to tag" value={asset.peopleToTag} onChange={(v) => set({ peopleToTag: v })} />
            <Field label="Caption idea already in mind" value={asset.captionIdea} onChange={(v) => set({ captionIdea: v })} textarea />
            <Field label="Tags (comma separated)" value={asset.tags.join(', ')} onChange={(v) => set({ tags: v.split(',').map((t) => t.trim()).filter(Boolean) })} />
            <Field label="Notes" value={asset.notes} onChange={(v) => set({ notes: v })} textarea />
          </div>

          {/* Repurposing */}
          <div className="card p-4">
            <div className="mb-2 font-serif text-valmer-slate">Ways to repurpose</div>
            <ul className="space-y-1 text-sm text-valmer-slate/80">
              {repurposeIdeas(asset).map((idea, i) => (
                <li key={i} className="flex gap-2"><span className="text-valmer-clay">→</span> {idea}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={createPostFromAsset} className="btn-primary" disabled={asset.status === 'unusable' || busy}>
              {busy ? 'Writing…' : useAI ? 'Generate caption (AI) + add to calendar' : 'Generate caption + add to calendar'}
            </button>
            <button
              onClick={() => set({ status: asset.status === 'unusable' ? 'unused' : 'unusable' })}
              className="btn-outline"
            >
              {asset.status === 'unusable' ? 'Mark usable' : 'Mark unusable'}
            </button>
            <button onClick={() => { removeAsset(asset.id); onClose() }} className="btn text-rose-600 hover:bg-rose-50">
              Delete
            </button>
          </div>
        </div>
      </div>

      {lightbox && <Lightbox asset={asset} onClose={() => setLightbox(false)} />}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-valmer-slate/50">{k}</dt>
      <dd className="text-right font-medium capitalize">{v}</dd>
    </>
  )
}

function Field({ label, value, onChange, type, textarea }: { label: string; value: string; onChange: (v: string) => void; type?: string; textarea?: boolean }) {
  return (
    <div>
      <label className="label">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="input" />
      ) : (
        <input type={type || 'text'} value={value} onChange={(e) => onChange(e.target.value)} className="input" />
      )}
    </div>
  )
}

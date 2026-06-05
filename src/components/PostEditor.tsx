import { useState } from 'react'
import { useStore } from '../store/useStore'
import { PLATFORMS, POST_STATUSES } from '../types'
import type { Platform, ScheduledPost } from '../types'
import { CAPTION_CONTROLS, applyControl, generateCaption, platformVersion } from '../engine/caption'
import type { CaptionControl } from '../engine/caption'
import { aiGenerateCaption, aiGenerateEmail, aiReady, aiTransformCaption } from '../engine/ai'
import type { CaptionResult } from '../engine/ai'
import { metaReady, publishFacebookPhoto, publishFacebookText } from '../engine/meta'
import { cls } from '../lib/ui'
import Thumbnail from './Thumbnail'
import Lightbox from './Lightbox'

export default function PostEditor({ postId, onClose }: { postId: string; onClose: () => void }) {
  const { posts, pillars, campaigns, assets, people, aiConfig, metaConfig, updatePost, removePost, regenerateCaptionForPost, addEmailVersionToPost, repromptCaption } =
    useStore()
  const post = posts.find((p) => p.id === postId)
  const [assetPicker, setAssetPicker] = useState(false)
  const [guidance, setGuidance] = useState(post?.promptNotes || '')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiErr, setAiErr] = useState<string | null>(null)
  const [pubBusy, setPubBusy] = useState(false)
  const [pubMsg, setPubMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  if (!post) return null

  const postAssets = assets.filter((a) => post.assetIds.includes(a.id))
  const primaryAsset = postAssets[0]
  const pillar = pillars.find((p) => p.id === post.pillarId)
  const set = (patch: Partial<ScheduledPost>) => updatePost(post.id, patch)
  const isEmail = post.platforms.includes('email')
  const useAI = aiReady(aiConfig)
  const aiCtx = { asset: primaryAsset, pillar, people, carousel: post.format === 'carousel' || post.assetIds.length > 1 }

  async function runAI(work: Promise<CaptionResult>, extra?: Partial<ScheduledPost>) {
    setAiBusy(true)
    setAiErr(null)
    try {
      const r = await work
      set({ caption: r.caption, hook: r.hook, cta: r.cta, hashtags: r.hashtags || post!.hashtags, ...extra })
    } catch (e: any) {
      setAiErr(e?.message || 'AI request failed.')
    } finally {
      setAiBusy(false)
    }
  }

  const togglePlatform = (pl: Platform) =>
    set({ platforms: post.platforms.includes(pl) ? post.platforms.filter((x) => x !== pl) : [...post.platforms, pl] })

  const regenerate = () => {
    if (useAI) runAI(aiGenerateCaption(aiConfig, aiCtx))
    else regenerateCaptionForPost(post.id)
  }

  const runControl = (c: CaptionControl) => {
    const label = CAPTION_CONTROLS.find((x) => x.id === c)?.label || c
    if (useAI) runAI(aiTransformCaption(aiConfig, post.caption, label, aiCtx))
    else set({ caption: applyControl(post.caption, c, post.cta) })
  }

  const doReprompt = () => {
    if (useAI) runAI(aiTransformCaption(aiConfig, post.caption, `Incorporate this new information from the marketer and rewrite the caption around it: ${guidance}`, aiCtx), { promptNotes: guidance })
    else repromptCaption(post.id, guidance)
  }

  const writeVersion = async (pl: Platform) => {
    if (pl === 'email') {
      if (useAI && primaryAsset) {
        setAiBusy(true)
        setAiErr(null)
        try {
          const e = await aiGenerateEmail(aiConfig, { asset: primaryAsset, pillar, people, guidance: post.promptNotes })
          set({ platforms: Array.from(new Set([...post.platforms, 'email'])) as Platform[], emailSubject: e.subject, emailPreview: e.preview, emailBody: e.body })
        } catch (err: any) {
          setAiErr(err?.message || 'AI request failed.')
        } finally {
          setAiBusy(false)
        }
      } else {
        addEmailVersionToPost(post.id)
      }
      return
    }
    if (useAI) {
      runAI(aiGenerateCaption(aiConfig, { ...aiCtx, platform: pl }))
      return
    }
    const src = post.caption || (primaryAsset ? generateCaption(primaryAsset, pillar).caption : '')
    set({ caption: platformVersion(src, pl, primaryAsset || ({} as any)) })
  }

  const metaOn = metaReady(metaConfig)
  const publishToFacebook = async () => {
    const ok = window.confirm(
      `Publish this post to your Facebook Page now? This is live and public.\n\n"${post.caption.slice(0, 140)}${post.caption.length > 140 ? '…' : ''}"`,
    )
    if (!ok) return
    setPubBusy(true)
    setPubMsg(null)
    try {
      const message = [post.caption, post.hashtags].filter(Boolean).join('\n\n')
      const res = primaryAsset
        ? await publishFacebookPhoto(metaConfig, primaryAsset.id, message)
        : await publishFacebookText(metaConfig, message)
      set({ status: 'posted' })
      setPubMsg({ ok: true, text: `Posted to Facebook (id ${res.id}).` })
    } catch (e: any) {
      setPubMsg({ ok: false, text: e?.message || 'Publishing failed.' })
    } finally {
      setPubBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-auto bg-valmer-mist shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white px-5 py-3">
          <input
            value={post.title}
            onChange={(e) => set({ title: e.target.value })}
            className="flex-1 bg-transparent text-lg font-serif outline-none"
          />
          <div className="flex items-center gap-2">
            <select value={post.status} onChange={(e) => set({ status: e.target.value as any })} className="input w-32 py-1">
              {POST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button onClick={onClose} className="btn-ghost px-2">
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {/* big image preview */}
          {primaryAsset && (
            <button onClick={() => setLightbox(primaryAsset.id)} className="group relative block w-full overflow-hidden rounded-xl" title="Click to enlarge">
              <Thumbnail asset={primaryAsset} className="aspect-[16/10] w-full" />
              <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">Click to enlarge</span>
            </button>
          )}

          {/* meta row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" value={post.scheduledDate} onChange={(e) => set({ scheduledDate: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Content pillar</label>
              <select value={post.pillarId || ''} onChange={(e) => set({ pillarId: e.target.value || undefined })} className="input">
                <option value="">None</option>
                {pillars.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Campaign</label>
              <select value={post.campaignId || ''} onChange={(e) => set({ campaignId: e.target.value || undefined })} className="input">
                <option value="">None</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Optional post</label>
              <button
                onClick={() => set({ optional: !post.optional })}
                className={cls('btn w-full', post.optional ? 'bg-valmer-gold/20 text-valmer-gold' : 'btn-outline')}
              >
                {post.optional ? 'Extra / timely post' : 'Part of cadence'}
              </button>
            </div>
          </div>

          {/* platforms */}
          <div>
            <label className="label">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => togglePlatform(pl.id)}
                  className={cls('chip border', post.platforms.includes(pl.id) ? 'bg-valmer-slate text-white border-valmer-slate' : 'border-black/15 text-valmer-slate')}
                >
                  {pl.label}
                </button>
              ))}
            </div>
          </div>

          {/* assets */}
          <div>
            <div className="flex items-center gap-2">
              <label className="label mb-0">Assets</label>
              {(post.format === 'carousel' || post.assetIds.length > 1) && (
                <span className="chip bg-valmer-gold/20 text-[10px] text-valmer-gold">Carousel · {post.assetIds.length} images</span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {postAssets.map((a) => (
                <div key={a.id} className="relative">
                  <button onClick={() => setLightbox(a.id)} title="Click to enlarge">
                    <Thumbnail asset={a} className="h-16 w-16 rounded-lg" />
                  </button>
                  <button
                    onClick={() => set({ assetIds: post.assetIds.filter((x) => x !== a.id) })}
                    className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-white text-xs shadow"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button onClick={() => setAssetPicker((v) => !v)} className="h-16 w-16 rounded-lg border-2 border-dashed border-black/15 text-2xl text-valmer-slate/50">
                +
              </button>
            </div>
            {assetPicker && (
              <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-black/10 bg-white p-2">
                {assets.filter((a) => !post.assetIds.includes(a.id)).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      set({ assetIds: [...post.assetIds, a.id] })
                      setAssetPicker(false)
                    }}
                    className="flex w-full items-center gap-2 rounded p-1 text-left text-sm hover:bg-black/5"
                  >
                    <Thumbnail asset={a} className="h-8 w-8 rounded" />
                    <span className="truncate">{a.title}</span>
                  </button>
                ))}
                {assets.filter((a) => !post.assetIds.includes(a.id)).length === 0 && (
                  <div className="p-2 text-sm text-valmer-slate/50">No more assets to add.</div>
                )}
              </div>
            )}
          </div>

          {/* caption + AI controls */}
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="label mb-0">Caption</label>
                <span className={cls('chip text-[10px]', useAI ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                  {useAI ? `AI: ${aiConfig.model}` : 'built-in writer'}
                </span>
                {aiBusy && <span className="text-xs text-valmer-sage">writing…</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={regenerate} className="btn-outline py-1 text-xs" disabled={!primaryAsset || aiBusy}>
                  Regenerate
                </button>
              </div>
            </div>
            {aiErr && <div className="mb-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{aiErr}</div>}
            <input value={post.hook} onChange={(e) => set({ hook: e.target.value })} placeholder="Hook" className="input mb-2 font-medium" />
            <textarea value={post.caption} onChange={(e) => set({ caption: e.target.value })} rows={6} className="input mb-2" placeholder="Write the caption that answers: why does this matter?" />
            <div className="flex flex-wrap gap-1.5">
              {CAPTION_CONTROLS.map((c) => (
                <button key={c.id} onClick={() => runControl(c.id)} disabled={aiBusy} className="chip border border-black/10 text-valmer-slate hover:bg-black/5 disabled:opacity-50">
                  {c.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-xs text-valmer-slate/50 self-center">Write version:</span>
              {(['instagram', 'facebook', 'tiktok', 'email'] as Platform[]).map((pl) => (
                <button key={pl} onClick={() => writeVersion(pl)} disabled={aiBusy} className="chip bg-valmer-sage/15 text-valmer-sage disabled:opacity-50">
                  {PLATFORMS.find((p) => p.id === pl)?.short}
                </button>
              ))}
            </div>

            {/* Re-prompt with new info */}
            <div className="mt-3 rounded-lg bg-valmer-sand/40 p-3">
              <label className="label">Re-prompt with new info</label>
              <p className="-mt-0.5 mb-2 text-[11px] text-valmer-slate/55">
                Tell the strategist what it is missing (what happened, who is in it, the angle you want) and rewrite the caption around it.
              </p>
              <textarea
                value={guidance}
                onChange={(e) => setGuidance(e.target.value)}
                rows={2}
                placeholder="e.g. This was our 10-year anniversary party. Sarah just hit 100 closings. Make it about gratitude."
                className="input mb-2"
              />
              <button
                onClick={doReprompt}
                disabled={!primaryAsset || !guidance.trim() || aiBusy}
                className="btn-primary py-1.5 text-xs"
              >
                {aiBusy ? 'Writing…' : 'Rewrite caption with this'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">CTA</label>
              <input value={post.cta} onChange={(e) => set({ cta: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Hashtags (optional)</label>
              <input value={post.hashtags} onChange={(e) => set({ hashtags: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Alt text (optional)</label>
              <input value={post.altText} onChange={(e) => set({ altText: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Story / Reel overlay ideas</label>
              <input value={post.overlayIdeas} onChange={(e) => set({ overlayIdeas: e.target.value })} className="input" />
            </div>
          </div>

          {/* email block */}
          {isEmail && (
            <div className="card p-4 space-y-2">
              <div className="font-serif text-valmer-slate">Email version</div>
              <input value={post.emailSubject} onChange={(e) => set({ emailSubject: e.target.value })} placeholder="Subject line" className="input" />
              <input value={post.emailPreview} onChange={(e) => set({ emailPreview: e.target.value })} placeholder="Preview text" className="input" />
              <textarea value={post.emailBody} onChange={(e) => set({ emailBody: e.target.value })} rows={6} placeholder="Email body" className="input" />
              <button onClick={() => addEmailVersionToPost(post.id)} className="btn-outline text-xs" disabled={!primaryAsset}>
                Generate email from asset
              </button>
            </div>
          )}

          {/* Publish to Meta */}
          <div className="card p-4">
            <div className="mb-1 flex items-center justify-between">
              <div className="font-serif text-valmer-slate">Publish</div>
              <span className={cls('chip text-[10px]', metaOn ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                {metaOn ? 'Facebook connected' : 'Not connected'}
              </span>
            </div>
            {post.platforms.includes('facebook') ? (
              <>
                <p className="mb-2 text-xs text-valmer-slate/60">
                  Posts the {primaryAsset ? 'photo and caption' : 'caption'} straight to your Facebook Page. You will confirm first. Instagram is not supported from this local tool yet (see Publish to Meta settings).
                </p>
                <button onClick={publishToFacebook} disabled={!metaOn || pubBusy || !post.caption.trim()} className="btn-primary py-1.5 text-sm">
                  {pubBusy ? 'Publishing…' : 'Publish to Facebook now'}
                </button>
                {pubMsg && (
                  <div className={cls('mt-2 rounded-md px-3 py-2 text-xs', pubMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
                    {pubMsg.text}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-valmer-slate/60">Add Facebook to this post's platforms to publish it here.</p>
            )}
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea value={post.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} className="input" />
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => {
                removePost(post.id)
                onClose()
              }}
              className="btn text-rose-600 hover:bg-rose-50"
            >
              Delete post
            </button>
            <button onClick={onClose} className="btn-primary">
              Done
            </button>
          </div>
        </div>
      </div>

      {lightbox && (() => {
        const a = assets.find((x) => x.id === lightbox)
        return a ? <Lightbox asset={a} onClose={() => setLightbox(null)} /> : null
      })()}
    </div>
  )
}

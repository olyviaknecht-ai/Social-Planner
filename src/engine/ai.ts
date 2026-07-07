import type {
  AIConfig,
  ContentAsset,
  ContentPillar,
  PersonMemory,
  Platform,
} from '../types'
import { sanitizeVoice } from './caption'

export interface CaptionResult {
  hook: string
  caption: string
  cta: string
  hashtags: string
}

export function aiReady(cfg?: AIConfig): boolean {
  return !!cfg && cfg.enabled && cfg.apiKey.trim().length > 10
}

// Same-origin proxy (configured in vite.config.ts) to avoid browser CORS issues.
const OPENAI_URL = '/openai-proxy/v1/chat/completions'

export interface BrandContext {
  name: string
  brief?: string
  voice?: string // pasted examples of the brand's real past posts
}

// Universal copywriting rules applied to every brand.
const RULES = `A great caption never just describes the photo. It answers: Why does this matter? What does
this show about the brand? Why should the reader care? What feeling does it create? What should they do next?

VOICE: warm, grounded, polished, human, modern, relationship-first, helpful. Plain language. Specific
real details over generic filler. Lead with people and real moments.

HARD RULES:
- Never use em dashes. Use commas or periods.
- Never use these words/phrases: "elevate", "seamless", "your trusted partner", "valuable insights",
  "in today's market", "whether you're buying or selling", "leverage", "unlock", "game-changer".
- At most one exclamation point in the whole caption, and only if it is genuinely warranted.
- No obvious AI structure, no "In conclusion", no stiff corporate tone, no hashtag stuffing in the body.
- Do not sound generic. If a sentence could belong to any brand in this industry, rewrite it.

If specific people are named with roles, refer to them naturally and warmly by name.`

// Build the system prompt for a specific brand (falls back to Valmer if none set).
function systemPrompt(brand?: BrandContext): string {
  const intro = brand?.brief
    ? `You are the social media strategist and copywriter for ${brand.name}.\nBrand context: ${brand.brief}`
    : `You are the social media strategist and copywriter for ${brand?.name || 'Valmer Land Title, a title company whose audience is real estate agents'}.`
  const voice = brand?.voice?.trim()
    ? `\n\nHere are real past posts from this brand. Study them and match this exact voice, tone, rhythm, and vocabulary:\n"""\n${brand.voice.trim().slice(0, 4000)}\n"""`
    : ''
  return `${intro}${voice}\n\n${RULES}`
}

const OUTPUT = `Respond with ONLY a JSON object, no markdown, with exactly these keys:
{"caption": string, "cta": string}
- "caption": the complete, copy-paste-ready post. Open with a scroll-stopping first line, then the body, and weave a natural call to action into the ending. Do NOT include any hashtags.
- "cta": just the call-to-action phrase (a few words), for internal tracking only.`

function platformGuide(platform?: Platform): string {
  switch (platform) {
    case 'instagram':
      return 'Platform: Instagram feed. 3 to 6 short paragraphs is fine. Friendly and visual.'
    case 'facebook':
      return 'Platform: Facebook. Slightly more conversational, fewer or no hashtags.'
    case 'tiktok':
      return 'Platform: TikTok. Short, punchy, casual. One strong line plus a couple of casual hashtags.'
    case 'reels':
      return 'Platform: Instagram Reels. Very short, 1 to 2 lines, energetic.'
    case 'youtube':
      return 'Platform: YouTube. Write a title (under 70 chars) and a short description with a hook in the first line. Good for longer video or Shorts.'
    case 'email':
      return 'Platform: Email. Write it as a short email body with a greeting and sign-off from "The Valmer Team". hashtags should be empty.'
    default:
      return 'Platform: Instagram and Facebook.'
  }
}

function describe(opts: {
  asset?: ContentAsset
  pillar?: ContentPillar
  people?: PersonMemory[]
  carousel?: boolean
  guidance?: string
}): string {
  const { asset, pillar, people, carousel, guidance } = opts
  const lines: string[] = []
  if (asset) {
    lines.push(`Content title: ${asset.title}`)
    lines.push(`Media type: ${asset.fileType}${carousel ? ' (carousel / multiple images, you can reference swiping)' : ''}`)
    if (asset.analysis) lines.push(`Detected content type: ${asset.analysis.contentType}; emotional angle: ${asset.analysis.emotionalAngle}`)
    if (asset.event) lines.push(`Event / topic: ${asset.event}`)
    if (asset.location) lines.push(`Location: ${asset.location}`)
    if (asset.captionIdea) lines.push(`Caption idea the team already had: ${asset.captionIdea}`)
    if (asset.ctaNote) lines.push(`Desired CTA / thing to mention: ${asset.ctaNote}`)
    if (asset.peopleToTag) lines.push(`Accounts to tag: ${asset.peopleToTag}`)
    // Resolve named people to their roles from the directory.
    if (asset.people?.trim()) {
      const named = asset.people.split(',').map((n) => n.trim()).filter(Boolean).map((n) => {
        const m = people?.find((p) => p.name && n.toLowerCase().includes(p.name.toLowerCase()))
        return m && m.role ? `${m.name} (${m.role})` : n
      })
      lines.push(`People in this content: ${named.join(', ')}`)
    }
  }
  if (pillar) lines.push(`Content pillar: ${pillar.title} — goal: ${pillar.goal}`)
  if (guidance?.trim()) lines.push(`IMPORTANT extra direction from the marketer: ${guidance.trim()}`)
  return lines.join('\n')
}

async function callOpenAI(cfg: AIConfig, messages: { role: string; content: string }[]): Promise<CaptionResult> {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': cfg.apiKey.trim(),
    },
    body: JSON.stringify({
      model: cfg.model || 'gpt-4o-mini',
      messages,
      temperature: 0.85,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = `OpenAI error ${res.status}`
    if (res.status === 401) msg = 'OpenAI rejected the API key (401). Check the key in AI settings.'
    else if (res.status === 429) msg = 'OpenAI rate limit or no credit (429). Check your OpenAI billing.'
    else if (text) msg += `: ${text.slice(0, 160)}`
    throw new Error(msg)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned an empty response.')
  let parsed: any
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('Could not parse the AI response.')
  }
  return {
    hook: '',
    caption: sanitizeVoice(String(parsed.caption || '')),
    cta: sanitizeVoice(String(parsed.cta || '')),
    hashtags: '',
  }
}

export async function aiGenerateCaption(
  cfg: AIConfig,
  opts: { asset?: ContentAsset; pillar?: ContentPillar; people?: PersonMemory[]; platform?: Platform; carousel?: boolean; guidance?: string; brand?: BrandContext },
): Promise<CaptionResult> {
  const user = `Write a single social post for the content below.\n\n${platformGuide(opts.platform)}\n\n${describe(opts)}\n\n${OUTPUT}`
  return callOpenAI(cfg, [
    { role: 'system', content: systemPrompt(opts.brand) },
    { role: 'user', content: user },
  ])
}

export async function aiTransformCaption(
  cfg: AIConfig,
  currentCaption: string,
  instruction: string,
  opts: { asset?: ContentAsset; pillar?: ContentPillar; people?: PersonMemory[]; platform?: Platform; carousel?: boolean; guidance?: string; brand?: BrandContext } = {},
): Promise<CaptionResult> {
  const user = `Here is the current caption:\n"""\n${currentCaption}\n"""\n\nRewrite it with this instruction: ${instruction}\n\nKeep the brand voice and all the hard rules. Context for reference:\n${describe(opts)}\n\n${platformGuide(opts.platform)}\n\n${OUTPUT}`
  return callOpenAI(cfg, [
    { role: 'system', content: systemPrompt(opts.brand) },
    { role: 'user', content: user },
  ])
}

export async function aiGenerateEmail(
  cfg: AIConfig,
  opts: { asset?: ContentAsset; pillar?: ContentPillar; people?: PersonMemory[]; guidance?: string; brand?: BrandContext },
): Promise<{ subject: string; preview: string; body: string }> {
  const signoff = opts.brand?.name ? `The ${opts.brand.name} Team` : 'The Valmer Team'
  const user = `Write a short marketing email for the content below.\n${platformGuide('email')}\n\n${describe(opts)}\n\nRespond with ONLY a JSON object: {"subject": string, "preview": string, "body": string}. The subject is under 9 words, the preview is one short line, the body is a warm short email ending with "${signoff}".`
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': cfg.apiKey.trim() },
    body: JSON.stringify({ model: cfg.model || 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt(opts.brand) }, { role: 'user', content: user }], temperature: 0.8, response_format: { type: 'json_object' } }),
  })
  if (!res.ok) throw new Error(res.status === 401 ? 'OpenAI rejected the API key (401).' : `OpenAI error ${res.status}`)
  const data = await res.json()
  const parsed = JSON.parse(data.choices[0].message.content)
  return {
    subject: sanitizeVoice(String(parsed.subject || '')),
    preview: sanitizeVoice(String(parsed.preview || '')),
    body: sanitizeVoice(String(parsed.body || '')),
  }
}

export interface BrandAnswers {
  name: string
  about: string
  audience: string
  goals: string
  vibe: string
  highlights: string
}

export interface BrandBuildResult {
  brief: string
  pillars: { title: string; description: string; goal: string; share: number }[]
}

// Onboarding: turn a few answers into a content strategy (brand brief + pillars).
export async function aiBuildBrand(cfg: AIConfig, a: BrandAnswers): Promise<BrandBuildResult> {
  const user = `Build a social media content strategy for this brand.

Brand name: ${a.name}
What they do: ${a.about}
Audience: ${a.audience}
Goals: ${a.goals}
What makes them different / their vibe: ${a.vibe}
Things to highlight (services, events, people): ${a.highlights}

Respond with ONLY a JSON object:
{"brief": string, "pillars": [{"title": string, "description": string, "goal": string, "share": number}]}
- "brief": 2-3 sentences capturing the brand's voice and positioning, written so it can steer a caption writer.
- "pillars": 5 to 7 content pillars tailored to THIS brand (not generic). Each has a short title, a one-line
  description of what goes in it, a one-line goal, and "share" (a fraction of how often to post it). Shares sum to ~1.0.`
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': cfg.apiKey.trim() },
    body: JSON.stringify({ model: cfg.model || 'gpt-4o-mini', messages: [{ role: 'system', content: 'You are a sharp brand strategist who designs focused, non-generic social content pillars.' }, { role: 'user', content: user }], temperature: 0.7, response_format: { type: 'json_object' } }),
  })
  if (!res.ok) throw new Error(res.status === 401 ? 'OpenAI rejected the API key (401).' : res.status === 429 ? 'OpenAI rate limit or no credit (429).' : `OpenAI error ${res.status}`)
  const data = await res.json()
  const parsed = JSON.parse(data.choices[0].message.content)
  const pillars = Array.isArray(parsed.pillars) ? parsed.pillars : []
  return {
    brief: String(parsed.brief || '').trim(),
    pillars: pillars.slice(0, 7).map((p: any) => ({
      title: String(p.title || 'Pillar').trim(),
      description: String(p.description || '').trim(),
      goal: String(p.goal || '').trim(),
      share: typeof p.share === 'number' && p.share > 0 ? p.share : 0.15,
    })),
  }
}

// Lightweight connectivity check used by the settings panel.
export async function aiTestKey(cfg: AIConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await aiTransformCaption(cfg, 'We had a great closing today.', 'Make it one warm sentence.', {})
    return { ok: true, message: r.caption ? 'Connected. Sample: ' + r.caption.slice(0, 80) : 'Connected.' }
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Connection failed.' }
  }
}

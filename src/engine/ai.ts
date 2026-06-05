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

// Valmer's brand voice, encoded for the model.
const VOICE = `You are the social media strategist and copywriter for Valmer Land Title, a title company.
Your audience is REAL ESTATE AGENTS (not home buyers/sellers). The goal of every post is one of:
emotional connection to Valmer, showing the value Valmer brings beyond title work, or driving event
registrations and engagement.

A great caption never just describes the photo. It answers: Why does this matter? What does this show
about Valmer? Why should an agent care? What feeling does it create? What should the reader do next?

VOICE: warm, grounded, polished, human, modern, relationship-first, helpful. Plain language. Specific
Valmer details over generic filler. Lead with people and real moments.

HARD RULES:
- Never use em dashes. Use commas or periods.
- Never use these words/phrases: "elevate", "seamless", "your trusted partner", "valuable insights",
  "in today's market", "whether you're buying or selling", "leverage", "unlock", "game-changer".
- At most one exclamation point in the whole caption, and only if it is genuinely warranted.
- No obvious AI structure, no "In conclusion", no stiff corporate tone, no hashtag stuffing in the body.
- Do not sound like every other title company. If a sentence could belong to any title company, rewrite it.

If specific people are named with roles, refer to them naturally and warmly by name.`

const OUTPUT = `Respond with ONLY a JSON object, no markdown, with exactly these keys:
{"hook": string, "caption": string, "cta": string, "hashtags": string}
- "hook": a short scroll-stopping first line (under 8 words).
- "caption": the full post body. Do NOT include hashtags in the caption body.
- "cta": one clear, low-pressure next step.
- "hashtags": 3 to 6 relevant hashtags separated by spaces, or an empty string for email.`

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
      Authorization: `Bearer ${cfg.apiKey.trim()}`,
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
    hook: sanitizeVoice(String(parsed.hook || '')),
    caption: sanitizeVoice(String(parsed.caption || '')),
    cta: sanitizeVoice(String(parsed.cta || '')),
    hashtags: String(parsed.hashtags || '').trim(),
  }
}

export async function aiGenerateCaption(
  cfg: AIConfig,
  opts: { asset?: ContentAsset; pillar?: ContentPillar; people?: PersonMemory[]; platform?: Platform; carousel?: boolean; guidance?: string },
): Promise<CaptionResult> {
  const user = `Write a single social post for the content below.\n\n${platformGuide(opts.platform)}\n\n${describe(opts)}\n\n${OUTPUT}`
  return callOpenAI(cfg, [
    { role: 'system', content: VOICE },
    { role: 'user', content: user },
  ])
}

export async function aiTransformCaption(
  cfg: AIConfig,
  currentCaption: string,
  instruction: string,
  opts: { asset?: ContentAsset; pillar?: ContentPillar; people?: PersonMemory[]; platform?: Platform; carousel?: boolean; guidance?: string } = {},
): Promise<CaptionResult> {
  const user = `Here is the current caption:\n"""\n${currentCaption}\n"""\n\nRewrite it with this instruction: ${instruction}\n\nKeep Valmer's voice and all the hard rules. Context for reference:\n${describe(opts)}\n\n${platformGuide(opts.platform)}\n\n${OUTPUT}`
  return callOpenAI(cfg, [
    { role: 'system', content: VOICE },
    { role: 'user', content: user },
  ])
}

export async function aiGenerateEmail(
  cfg: AIConfig,
  opts: { asset?: ContentAsset; pillar?: ContentPillar; people?: PersonMemory[]; guidance?: string },
): Promise<{ subject: string; preview: string; body: string }> {
  const user = `Write a short marketing email for the content below.\n${platformGuide('email')}\n\n${describe(opts)}\n\nRespond with ONLY a JSON object: {"subject": string, "preview": string, "body": string}. The subject is under 9 words, the preview is one short line, the body is a warm short email ending with "The Valmer Team".`
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey.trim()}` },
    body: JSON.stringify({ model: cfg.model || 'gpt-4o-mini', messages: [{ role: 'system', content: VOICE }, { role: 'user', content: user }], temperature: 0.8, response_format: { type: 'json_object' } }),
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

// Lightweight connectivity check used by the settings panel.
export async function aiTestKey(cfg: AIConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await aiTransformCaption(cfg, 'We had a great closing today.', 'Make it one warm sentence.', {})
    return { ok: true, message: r.caption ? 'Connected. Sample: ' + r.caption.slice(0, 80) : 'Connected.' }
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Connection failed.' }
  }
}

import type { MetaConfig } from '../types'
import { loadBlob } from '../store/blobs'

// Same-origin proxy (vite.config.ts) to reach the Graph API without CORS issues.
const GRAPH = '/meta-proxy/v19.0'
const FB_VERSION = 'v19.0'

declare global {
  interface Window {
    FB?: any
  }
}

export function metaReady(cfg?: MetaConfig): boolean {
  return !!cfg && cfg.pageId.trim().length > 3 && cfg.pageToken.trim().length > 20
}

// ---- Facebook Login (so the user never copies a token by hand) ----

// Modern Page permissions only. (Old manage_pages / publish_pages were removed by Meta.)
export const REQUIRED_SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'] as const

export interface FbDebug {
  status?: string
  granted: string[]
  declined: string[]
  raw: any
}

let sdkPromise: Promise<void> | null = null
let initedAppId = ''

// Preload + initialize the SDK. Call this when the App ID is known, BEFORE the user
// clicks Connect, so that FB.login can run synchronously inside the click gesture
// (otherwise the popup gets blocked and Meta returns no authResponse).
export function ensureFbSdk(appId: string): Promise<void> {
  const id = appId.trim()
  if (!id) return Promise.reject(new Error('Enter your Meta App ID first.'))
  if (window.FB) {
    if (initedAppId !== id) {
      window.FB.init({ appId: id, version: FB_VERSION, cookie: true, xfbml: false })
      initedAppId = id
    }
    return Promise.resolve()
  }
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://connect.facebook.net/en_US/sdk.js'
    s.async = true
    s.defer = true
    s.crossOrigin = 'anonymous'
    s.onload = () => {
      try {
        window.FB.init({ appId: id, version: FB_VERSION, cookie: true, xfbml: false })
        initedAppId = id
        resolve()
      } catch (e: any) {
        reject(new Error('Facebook SDK failed to initialize: ' + (e?.message || 'unknown error')))
      }
    }
    s.onerror = () => reject(new Error('Could not load the Facebook SDK. A network block or ad blocker may be stopping connect.facebook.net.'))
    document.body.appendChild(s)
  })
  return sdkPromise
}

function describeStatus(res: any): string {
  switch (res?.status) {
    case 'not_authorized':
      return 'You are logged into Facebook but did not authorize the app. If the app is in Development mode, your account must be an Admin/Developer/Tester on the app.'
    case 'unknown':
    default:
      return 'The login window closed before you finished authorizing (or the popup was blocked). Allow popups for localhost and try again.'
  }
}

// Log in with Facebook, then auto-fetch the Page access token for the given Page ID.
// IMPORTANT: assumes ensureFbSdk() already ran, so FB.login fires inside the gesture.
export async function connectFacebook(
  appId: string,
  wantedPageId: string | undefined,
  onDebug?: (d: FbDebug) => void,
): Promise<{ pageId: string; pageToken: string; pageName: string }> {
  if (!appId.trim()) throw new Error('Enter your Meta App ID first.')
  if (!window.FB) throw new Error('Facebook SDK is still loading. Wait a second, then click Connect again.')
  // Re-init in case the App ID changed since load.
  if (initedAppId !== appId.trim()) {
    window.FB.init({ appId: appId.trim(), version: FB_VERSION, cookie: true, xfbml: false })
    initedAppId = appId.trim()
  }

  // No await before this — FB.login must run in the same tick as the click.
  const loginRes = await new Promise<any>((resolve) => {
    window.FB.login((res: any) => resolve(res), {
      scope: REQUIRED_SCOPES.join(','),
      return_scopes: true, // so we can read which scopes were granted vs declined
      auth_type: 'rerequest', // re-prompt for permissions the user declined before
    })
  })

  const granted = String(loginRes?.authResponse?.grantedScopes || '').split(',').filter(Boolean)
  const declined = REQUIRED_SCOPES.filter((s) => !granted.includes(s))
  // eslint-disable-next-line no-console
  console.log('[Meta] FB.login response:', loginRes, '| granted:', granted, '| declined:', declined)
  onDebug?.({ status: loginRes?.status, granted, declined, raw: loginRes })

  if (loginRes?.status !== 'connected' || !loginRes.authResponse) {
    throw new Error(`Login did not complete (status: ${loginRes?.status || 'unknown'}). ${describeStatus(loginRes)}`)
  }
  if (declined.length) {
    throw new Error(`Login succeeded but these permissions were not granted: ${declined.join(', ')}. Click Connect again and approve all of them.`)
  }

  const pages = await new Promise<any[]>((resolve, reject) => {
    window.FB.api('/me/accounts', { access_token: loginRes.authResponse.accessToken, fields: 'id,name,access_token' }, (res: any) =>
      res && !res.error ? resolve(res.data || []) : reject(new Error(res?.error?.message || 'Could not read your Pages.')),
    )
  })

  if (!pages.length) throw new Error('Login worked, but no Pages were returned. Make sure your account is an admin of the Page and that you approved Page access in the popup.')
  const page = wantedPageId?.trim() ? pages.find((p) => String(p.id) === wantedPageId.trim()) : pages[0]
  if (!page) {
    throw new Error(`Page ID ${wantedPageId} was not found. Pages you manage: ${pages.map((p) => `${p.name} (${p.id})`).join(', ')}`)
  }
  return { pageId: String(page.id), pageToken: page.access_token, pageName: page.name }
}

async function graphError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    return data?.error?.message || `Graph API error ${res.status}`
  } catch {
    return `Graph API error ${res.status}`
  }
}

// Verify the token + page by reading the page name.
export async function metaTest(cfg: MetaConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(cfg.pageId)}?fields=name,username&access_token=${encodeURIComponent(cfg.pageToken)}`)
    if (!res.ok) return { ok: false, message: await graphError(res) }
    const data = await res.json()
    return { ok: true, message: `Connected to “${data.name}”.` }
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Could not reach the Graph API.' }
  }
}

// Publish a text/link post to the Facebook Page feed.
export async function publishFacebookText(cfg: MetaConfig, message: string): Promise<{ id: string; permalink?: string }> {
  const body = new URLSearchParams({ message, access_token: cfg.pageToken })
  const res = await fetch(`${GRAPH}/${encodeURIComponent(cfg.pageId)}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(await graphError(res))
  const data = await res.json()
  return { id: data.id }
}

// Publish a photo (the actual local image) with a caption to the Facebook Page.
export async function publishFacebookPhoto(cfg: MetaConfig, assetId: string, caption: string): Promise<{ id: string }> {
  const blob = await loadBlob(assetId)
  if (!blob) {
    // No stored image bytes — fall back to a text post so nothing is lost.
    return publishFacebookText(cfg, caption)
  }
  const form = new FormData()
  form.append('caption', caption)
  form.append('access_token', cfg.pageToken)
  form.append('source', blob, 'valmer-post.jpg')
  const res = await fetch(`${GRAPH}/${encodeURIComponent(cfg.pageId)}/photos`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await graphError(res))
  const data = await res.json()
  return { id: data.post_id || data.id }
}

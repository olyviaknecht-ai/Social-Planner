// Thin client for the app's own backend API (accounts + shared brands).
async function req(path: string, opts?: RequestInit): Promise<any> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
    ...opts,
  })
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      msg = (await res.json()).error || msg
    } catch {
      /* non-json */
    }
    throw new Error(msg)
  }
  if (res.status === 204) return null
  return res.json()
}

export interface ApiUser {
  id: string
  email: string
  name: string
}
export interface ApiBrand {
  id: string
  name: string
  role: 'owner' | 'editor' | 'viewer'
  updatedAt?: string
  updatedByName?: string
  updatedByEmail?: string
}

export const api = {
  me: () => req('/api/me') as Promise<{ user: ApiUser }>,
  signup: (email: string, password: string, name: string) => req('/api/signup', { method: 'POST', body: JSON.stringify({ email, password, name }) }) as Promise<{ user: ApiUser }>,
  login: (email: string, password: string) => req('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) }) as Promise<{ user: ApiUser }>,
  logout: () => req('/api/logout', { method: 'POST' }),
  listBrands: () => req('/api/brands') as Promise<{ brands: ApiBrand[] }>,
  createBrand: (name: string, content: unknown) => req('/api/brands', { method: 'POST', body: JSON.stringify({ name, content }) }) as Promise<{ id: string; name: string }>,
  getBrand: (id: string) => req(`/api/brands/${id}`) as Promise<{ id: string; name: string; content: string; role: string; updatedAt: string; members: { email: string; name: string; role: string }[]; invites: { email: string; role: string }[] }>,
  saveBrand: (id: string, content: unknown, summary: string) => req(`/api/brands/${id}`, { method: 'PUT', body: JSON.stringify({ content, summary }) }),
  renameBrand: (id: string, name: string) => req(`/api/brands/${id}/rename`, { method: 'POST', body: JSON.stringify({ name }) }),
  deleteBrand: (id: string) => req(`/api/brands/${id}`, { method: 'DELETE' }),
  shareBrand: (id: string, email: string, role: string) => req(`/api/brands/${id}/share`, { method: 'POST', body: JSON.stringify({ email, role }) }) as Promise<{ status: string; email: string; role: string }>,
  unshareBrand: (id: string, email: string) => req(`/api/brands/${id}/unshare`, { method: 'POST', body: JSON.stringify({ email }) }),
  createInviteLink: (id: string, role: string) => req(`/api/brands/${id}/invite-link`, { method: 'POST', body: JSON.stringify({ role }) }) as Promise<{ token: string; role: string }>,
  acceptInvite: (token: string) => req(`/api/invite/${token}/accept`, { method: 'POST' }) as Promise<{ brandId: string }>,
  activity: (id: string) => req(`/api/brands/${id}/activity`) as Promise<{ activity: { at: string; summary: string; name: string; email: string }[] }>,
}

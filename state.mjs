import { getStore } from '@netlify/blobs'
import { getUser } from '@netlify/identity'

const STORE = 'maqbara-shadar-fund'
const KEY = 'fund-state-v3'

function json(data, status = 200, extra = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...extra } })
}

function roleOf(user) {
  return user?.roles?.includes('accountant') || user?.roles?.includes('admin') ? 'accountant' : 'member'
}

export default async (request) => {
  const user = await getUser()
  if (!user) return json({ error: 'UNAUTHORIZED' }, 401)

  const role = roleOf(user)
  const store = getStore({ name: STORE, consistency: 'strong' })

  if (request.method === 'GET') {
    const entry = await store.getWithMetadata(KEY, { type: 'json', consistency: 'strong' })
    return json({
      user: { id: user.id, email: user.email, name: user.userMetadata?.full_name || user.email },
      role,
      state: entry?.data ?? null,
      etag: entry?.etag ?? null
    })
  }

  if (request.method !== 'PUT') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
  if (role !== 'accountant') return json({ error: 'FORBIDDEN' }, 403)

  let payload
  try { payload = await request.json() } catch { return json({ error: 'INVALID_JSON' }, 400) }
  if (!payload || typeof payload !== 'object') return json({ error: 'INVALID_PAYLOAD' }, 400)

  const clean = {
    members: Array.isArray(payload.members) ? payload.members : [],
    receipts: Array.isArray(payload.receipts) ? payload.receipts : [],
    payments: Array.isArray(payload.payments) ? payload.payments : [],
    settings: payload.settings && typeof payload.settings === 'object' ? payload.settings : {},
    stamp: typeof payload.stamp === 'string' ? payload.stamp : '',
    updatedAt: new Date().toISOString(),
    updatedBy: user.id
  }

  const current = await store.getWithMetadata(KEY, { type: 'json', consistency: 'strong' })
  const ifMatch = request.headers.get('If-Match')
  const options = ifMatch ? { onlyIfMatch: ifMatch } : current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true }
  const result = await store.set(KEY, JSON.stringify(clean), { ...options, metadata: { updatedAt: clean.updatedAt, updatedBy: user.id } })

  if (!result.modified) {
    const latest = await store.getWithMetadata(KEY, { type: 'json', consistency: 'strong' })
    return json({ error: 'CONFLICT', etag: latest?.etag ?? null }, 409)
  }

  return json({ ok: true, etag: result.etag ?? null, updatedAt: clean.updatedAt })
}

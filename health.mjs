import { getUser } from '@netlify/identity'
export default async () => {
  const user = await getUser()
  return Response.json({ ok: true, identity: !!user, service: 'صندوق المقبرة والشادر' })
}

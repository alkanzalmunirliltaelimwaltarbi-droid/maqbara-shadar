export default {
  userSignup(event) {
    const email = String(event.user.email || '').trim().toLowerCase()
    const owner = String(process.env.NETLIFY_OWNER_EMAIL || '').trim().toLowerCase()
    const roles = owner && email === owner ? ['accountant'] : ['member']
    return {
      user: {
        ...event.user,
        appMetadata: {
          ...(event.user.appMetadata || {}),
          roles
        }
      }
    }
  }
}

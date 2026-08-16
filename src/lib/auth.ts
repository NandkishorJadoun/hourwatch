import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { env } from 'cloudflare:workers'

import { db } from '#/lib/db'
import * as schema from '#/db/schema'

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema,
  }),
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      accessType: 'offline',
      prompt: 'select_account consent',
      scope: ['https://www.googleapis.com/auth/youtube.readonly'],
    },
  },
  plugins: [tanstackStartCookies()],
})
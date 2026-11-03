import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { db } from './db.js';

const { BETTER_AUTH_SECRET, CLIENT_URL = 'http://localhost:3000', GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NODE_ENV } = process.env;
const prod = NODE_ENV === 'production';
const origins = CLIENT_URL.split(',').map((s) => s.trim());

export const buildAuth = (database) =>
  betterAuth({
    database,
    secret: BETTER_AUTH_SECRET,
    baseURL: origins[0],
    trustedOrigins: origins,
    emailAndPassword: { enabled: true, minPasswordLength: 6, autoSignIn: false },
    socialProviders: GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET ? { google: { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET } } : {},
    session: { cookieCache: { enabled: true, maxAge: 5 * 60, strategy: 'jwt' } },
    advanced: { defaultCookieAttributes: { httpOnly: true, secure: prod, sameSite: prod ? 'none' : 'lax' } },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/sign-up/email') return;
        const { password = '', image = '' } = ctx.body || {};
        const bad = (message) => { throw new APIError('BAD_REQUEST', { message }); };
        if (!/[A-Z]/.test(password)) bad('Password must include an uppercase letter.');
        if (!/[a-z]/.test(password)) bad('Password must include a lowercase letter.');
        if (password.length < 6) bad('Password must be at least 6 characters.');
        if (!/^https?:\/\//i.test(image)) bad('A profile photo URL is required.');
      }),
    },
  });
export const auth = buildAuth(mongodbAdapter(db));
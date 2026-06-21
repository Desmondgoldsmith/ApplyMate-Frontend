import { ensureServerEnv, normalizeNextAuthUrl } from '@/lib/server/ensure-env';

import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

import { getNextAuthBaseUrl } from '@/lib/nextauth-url';

function trimmedEnv(key: string): string {
  return process.env[key]?.trim() ?? '';
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(
    trimmedEnv('GOOGLE_CLIENT_ID') &&
    trimmedEnv('GOOGLE_CLIENT_SECRET') &&
    trimmedEnv('NEXTAUTH_SECRET'),
  );
}

export function getAuthOptions(): NextAuthOptions {
  ensureServerEnv();
  normalizeNextAuthUrl();

  const siteOrigin = (() => {
    try {
      return new URL(getNextAuthBaseUrl()).origin;
    } catch {
      return process.env.NEXTAUTH_URL?.trim() ?? 'http://localhost:3001';
    }
  })();

  return {
    secret: trimmedEnv('NEXTAUTH_SECRET'),
    debug: process.env.NODE_ENV === 'development',
    providers: isGoogleAuthConfigured()
      ? [
          GoogleProvider({
            clientId: trimmedEnv('GOOGLE_CLIENT_ID'),
            clientSecret: trimmedEnv('GOOGLE_CLIENT_SECRET'),
            /**
             * PKCE cookies often fail on Vercel/serverless (OAuthCallback after account pick).
             * Confidential web client + client secret — state check alone is sufficient.
             */
            checks: ['state'],
            authorization: {
              params: {
                prompt: 'select_account',
              },
            },
          }),
        ]
      : [],
    session: {
      strategy: 'jwt',
      maxAge: 10 * 60,
    },
    pages: {
      signIn: '/login',
      error: '/login',
    },
    callbacks: {
      async signIn({ account }) {
        return account?.provider === 'google';
      },
      async jwt({ token, account }) {
        if (account?.provider === 'google' && account.id_token) {
          token.googleIdToken = account.id_token;
        }
        return token;
      },
      async session({ session, token }) {
        if (
          typeof token.googleIdToken === 'string' &&
          token.googleIdToken.trim()
        ) {
          session.googleIdToken = token.googleIdToken;
        }
        return session;
      },
      async redirect({ url, baseUrl }) {
        const origin = siteOrigin || baseUrl;
        if (url.startsWith('/')) return `${origin}${url}`;
        try {
          const target = new URL(url);
          if (target.origin === new URL(origin).origin) return url;
        } catch {
          /* ignore */
        }
        if (url.startsWith(origin)) return url;
        return origin;
      },
    },
  };
}

export const authOptions = getAuthOptions();

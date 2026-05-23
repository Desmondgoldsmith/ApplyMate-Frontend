import '@/lib/server/ensure-env';

import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export function isGoogleAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim() &&
    process.env.NEXTAUTH_SECRET?.trim(),
  );
}

export function getAuthOptions(): NextAuthOptions {
  return {
    secret: process.env.NEXTAUTH_SECRET,
    debug: process.env.NODE_ENV === 'development',
    providers: isGoogleAuthConfigured()
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID ?? '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
            authorization: {
              params: {
                prompt: 'consent',
                access_type: 'online',
                response_type: 'code',
                scope: 'openid email profile',
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
        if (url.startsWith('/')) return `${baseUrl}${url}`;
        if (url.startsWith(baseUrl)) return url;
        return baseUrl;
      },
    },
  };
}

export const authOptions = getAuthOptions();

import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export function isGoogleAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'online',
          response_type: 'code',
        },
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    /** Short-lived — only bridges Google OAuth to ApplyMate API tokens. */
    maxAge: 10 * 60,
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ account }) {
      return account?.provider === 'google' && Boolean(account.id_token);
    },
    async jwt({ token, account }) {
      if (account?.provider === 'google' && account.id_token) {
        token.googleIdToken = account.id_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.googleIdToken) {
        session.googleIdToken = token.googleIdToken;
      }
      return session;
    },
  },
};

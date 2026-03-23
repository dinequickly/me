import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { saveGoogleTokens } from "@/lib/google-token-store";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    async jwt({ token, account }) {
      // First sign-in — persist tokens
      if (account) {
        if (account.refresh_token && account.access_token && account.expires_at) {
          saveGoogleTokens({
            refreshToken: account.refresh_token,
            accessToken: account.access_token,
            expiresAt: account.expires_at,
          }).catch(() => {});
        }
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }

      // Token still valid
      if (Date.now() < (token.expiresAt as number) * 1000) {
        return token;
      }

      // Refresh expired token
      try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken as string,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw data;
        return {
          ...token,
          accessToken: data.access_token,
          expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
        };
      } catch {
        return { ...token, error: "RefreshTokenError" };
      }
    },
    async session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken as string,
        refreshToken: token.refreshToken as string,
        error: token.error as string | undefined,
      };
    },
  },
});

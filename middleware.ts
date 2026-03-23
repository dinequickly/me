import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Use only the edge-compatible config here — no Node.js APIs
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};

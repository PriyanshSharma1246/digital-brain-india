import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Validate required env vars for authentication
const _requiredEnvs = [
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "DATABASE_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
];
const _missing = _requiredEnvs.filter((k) => !process.env[k]);
if (_missing.length > 0) {
  // Warn rather than throw so local dev/builds don't break unexpectedly,
  // but surface a clear hint for the common JWT decryption failure.
  // If you see "decryption operation failed", set `NEXTAUTH_SECRET`.
  // Example: `NEXTAUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")`
  // and set `NEXTAUTH_URL` to your app origin (e.g. http://localhost:3000).
  // Keep secrets out of source control (use .env.local or your hosting provider).
  console.warn("[auth] Missing environment variables:", _missing.join(", "));
}

async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const user = await findUserByEmail(credentials.email);
        if (!user) return null;

        const validPassword = await compare(credentials.password, user.password);
        if (!validPassword) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  jwt: {
    // Explicitly provide the secret and enable encryption to ensure tokens
    // are handled consistently across environments.
    secret: process.env.NEXTAUTH_SECRET ?? undefined,
  },
  callbacks: {
    async jwt({ token, user, profile }) {
      if (user?.email) {
        const foundUser = await findUserByEmail(user.email);
        if (foundUser) {
          token.id = foundUser.id;
          token.email = foundUser.email;
          token.name = foundUser.name;
        } else {
          token.id = user.id as string;
          token.email = user.email;
          token.name = user.name;
        }
      } else if (!token.id && profile?.email) {
        const foundUser = await findUserByEmail(profile.email);
        if (foundUser) {
          token.id = foundUser.id;
          token.email = foundUser.email;
          token.name = foundUser.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
    async signIn({ account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        const email = profile.email.toLowerCase();
        const existingUser = await findUserByEmail(email);
        if (!existingUser) {
          const placeholderPassword = await hash(crypto.randomUUID(), 12);
          await prisma.user.create({
            data: {
              email,
              name: profile.name ?? email.split("@")[0],
              password: placeholderPassword,
            },
          });
        }
      }

      return true;
    },
  },
  // Top-level secret used for signing/encrypting NextAuth tokens and cookies.
  // Must be a stable, strong value across deployments.
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};

import { NextAuthOptions, type Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { generateWorkspaceSlug } from "./slug";
import { UserRole } from "./roles";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { workspace: true },
        });

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password,
        );

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          workspaceId: user.workspaceId,
          role: user.role,
          sessionVersion: user.sessionVersion,
          emailVerified: user.emailVerified,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!existing) {
          // First-time Google sign-in: create a personal workspace.
          const workspace = await prisma.workspace.create({
            data: {
              name: `${user.name ?? user.email}'s workspace`,
              slug: generateWorkspaceSlug(
                `${user.name ?? user.email}'s workspace`,
              ),
            },
          });

          const created = await prisma.user.create({
            data: {
              email: user.email,
              name: user.name,
              role: "ADMIN",
              workspaceId: workspace.id,
              emailVerified: new Date(),
            },
          });

          user.id = created.id;
          user.workspaceId = created.workspaceId;
          user.role = created.role;
          user.sessionVersion = created.sessionVersion;
          user.emailVerified = created.emailVerified;
        } else {
          // Trust Google as a verified email source and backfill legacy users.
          if (!existing.emailVerified) {
            await prisma.user.update({
              where: { id: existing.id },
              data: { emailVerified: new Date() },
            });
          }

          user.id = existing.id;
          user.workspaceId = existing.workspaceId;
          user.role = existing.role;
          user.sessionVersion = existing.sessionVersion;
          user.emailVerified = existing.emailVerified ?? new Date();
        }
      }

      // Credentials users must verify their email before signing in.
      if (account?.provider === "credentials" && !user.emailVerified) {
        return false;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.workspaceId = user.workspaceId;
        token.role = user.role;
        token.sessionVersion = user.sessionVersion;
        token.emailVerified = user.emailVerified;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        // Validate that the user's session_version has not changed since the
        // JWT was issued. This invalidates all existing sessions on password
        // reset or future forced logout.
        const current = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { sessionVersion: true },
        });

        if (!current || current.sessionVersion !== token.sessionVersion) {
          // Return a session with empty ids so existing auth checks reject it.
          return {
            ...session,
            user: {
              ...session.user,
              id: "",
              workspaceId: "",
              sessionVersion: -1,
            },
          } as Session;
        }

        session.user.id = token.id as string;
        session.user.workspaceId = token.workspaceId as string;
        session.user.role = token.role as UserRole;
        session.user.sessionVersion = token.sessionVersion as number;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};

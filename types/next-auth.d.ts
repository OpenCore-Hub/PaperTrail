import { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      workspaceId: string;
      role: UserRole;
      sessionVersion: number;
    } & DefaultSession["user"];
  }

  interface User {
    workspaceId?: string;
    role?: UserRole;
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    workspaceId?: string;
    role?: UserRole;
    sessionVersion?: number;
  }
}

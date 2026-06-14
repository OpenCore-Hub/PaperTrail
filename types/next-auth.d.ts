import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      workspaceId: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    workspaceId?: string;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    workspaceId?: string;
    role?: string;
  }
}

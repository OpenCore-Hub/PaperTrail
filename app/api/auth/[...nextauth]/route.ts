import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRequestContext } from "@/lib/with-request-context";

const handler = withRequestContext(NextAuth(authOptions));

export { handler as GET, handler as POST };

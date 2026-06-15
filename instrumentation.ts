export async function register(): Promise<void> {
  // The shutdown handlers close Prisma / Redis connections, which are only
  // available in the Node.js runtime. Skip registration on Edge.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerShutdownHandlers } = await import("@/lib/shutdown");
    registerShutdownHandlers();
  }
}

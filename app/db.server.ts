import { PrismaClient } from "@prisma/client";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";

// Enable WebSocket for Neon serverless in Node.js environment
if (typeof WebSocket === "undefined") {
    neonConfig.webSocketConstructor = ws;
}

declare global {
    // eslint-disable-next-line no-var
    var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
    // For serverless environments (Vercel), use Neon adapter
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
        const connectionString = process.env.DATABASE_URL!;
        const pool = new Pool({ connectionString });
        // @ts-expect-error - PrismaNeon adapter type mismatch between packages
        const adapter = new PrismaNeon(pool);
        return new PrismaClient({ adapter });
    }

    // For local development, use standard Prisma
    return new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
}

// Prevent multiple instances of Prisma Client in development
const prisma = global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    global.__prisma = prisma;
}

export default prisma;

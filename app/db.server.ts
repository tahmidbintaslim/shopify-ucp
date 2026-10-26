import { PrismaClient } from "@prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";

// Node 20 has no global WebSocket; the Neon driver needs one.
if (typeof WebSocket === "undefined") {
    neonConfig.webSocketConstructor = ws;
}

declare global {
    // eslint-disable-next-line no-var
    var __prisma: PrismaClient | undefined;
}

/** True when DATABASE_URL is set. Routes check it to fail with a clear 503. */
export function isDatabaseConfigured(): boolean {
    return Boolean(process.env.DATABASE_URL);
}

function createPrismaClient(): PrismaClient {
    // Serverless (Vercel) and production builds use the Neon driver adapter.
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
        // PrismaNeon takes a pool config and creates the Pool itself. Passing
        // a Pool instance loses the connection string, and the driver then
        // fails with "No database host or connection string was set".
        const adapter = new PrismaNeon({
            connectionString: process.env.DATABASE_URL,
        });
        return new PrismaClient({ adapter });
    }

    // Local development uses the standard Prisma engine.
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

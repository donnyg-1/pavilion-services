import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // DATABASE_URL locally; Vercel's Postgres integrations may only set POSTGRES_URL.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL }) });
}

export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

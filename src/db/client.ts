import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

let shutdownRegistered = false;
if (!shutdownRegistered) {
  shutdownRegistered = true;
  const shutdown = async () => {
    await prisma.$disconnect();
  };
  process.once('beforeExit', shutdown);
  process.once('SIGINT', () => void shutdown().finally(() => process.exit(0)));
  process.once('SIGTERM', () => void shutdown().finally(() => process.exit(0)));
}

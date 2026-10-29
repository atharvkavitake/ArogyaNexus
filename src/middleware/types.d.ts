import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        sessionId: string;
        user: { id: string; role: Role; fullName: string; email: string };
      };
      profileId?: string;
      patientId?: string;
    }
  }
}

export {};

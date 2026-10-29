ALTER TYPE "AccessScope" ADD VALUE 'OWNER';

ALTER TABLE "profiles"
  ADD COLUMN "date_of_birth" TIMESTAMP(3),
  ADD COLUMN "sex" TEXT,
  ADD COLUMN "blood_group" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "conditions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "allergies_confirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "conditions_confirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "onboarding_step" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "onboarded_at" TIMESTAMP(3),
  ADD COLUMN "deleted_at" TIMESTAMP(3);

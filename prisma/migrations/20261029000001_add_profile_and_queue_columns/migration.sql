-- AlterTable
ALTER TABLE "doctor_profiles" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "experience_years" INTEGER,
ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "offers_video" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rating_avg" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "rating_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "cancelled_by" TEXT,
ADD COLUMN     "check_in_vitals" JSONB,
ADD COLUMN     "checked_in_at" TIMESTAMP(3),
ADD COLUMN     "missed_alert_sent_at" TIMESTAMP(3),
ADD COLUMN     "proposed_starts_at" TIMESTAMP(3),
ADD COLUMN     "token_number" INTEGER,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "allergies_confirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "blood_group" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "emergency_name" TEXT,
ADD COLUMN     "emergency_phone" TEXT,
ADD COLUMN     "emergency_relation" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "height_cm" DOUBLE PRECISION,
ADD COLUMN     "onboarded_at" TIMESTAMP(3),
ADD COLUMN     "onboarding_step" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "weight_kg" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "health_records" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "profile_access" ADD COLUMN     "level" TEXT NOT NULL DEFAULT 'OWNER';

-- AlterTable
ALTER TABLE "visit_records" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "diagnosis" TEXT,
ADD COLUMN     "doctor_profile_id" TEXT,
ADD COLUMN     "finalized_at" TIMESTAMP(3),
ADD COLUMN     "follow_up_date" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "profile_id" TEXT,
ADD COLUMN     "tests_advised" TEXT;

-- CreateIndex
CREATE INDEX "visit_records_profile_id_idx" ON "visit_records"("profile_id");

-- CreateIndex
CREATE INDEX "visit_records_doctor_profile_id_idx" ON "visit_records"("doctor_profile_id");

-- AddForeignKey
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_doctor_profile_id_fkey" FOREIGN KEY ("doctor_profile_id") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "health_records" ADD COLUMN "verification_status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "health_records" ADD COLUMN "verification_method" TEXT;
ALTER TABLE "health_records" ADD COLUMN "ai_confidence" DOUBLE PRECISION;
ALTER TABLE "health_records" ADD COLUMN "ai_extracted_fields" JSONB;
ALTER TABLE "health_records" ADD COLUMN "ai_verified_at" TIMESTAMP(3);
ALTER TABLE "health_records" ADD COLUMN "review_requested_at" TIMESTAMP(3);
ALTER TABLE "health_records" ADD COLUMN "assigned_doctor_id" TEXT;
ALTER TABLE "health_records" ADD COLUMN "reviewed_by_doctor_id" TEXT;
ALTER TABLE "health_records" ADD COLUMN "doctor_reviewed_at" TIMESTAMP(3);
ALTER TABLE "health_records" ADD COLUMN "rejection_reason" TEXT;
ALTER TABLE "health_records" ADD COLUMN "doctor_review_notes" TEXT;

-- CreateIndex
CREATE INDEX "health_records_patient_id_verification_status_idx" ON "health_records"("patient_id", "verification_status");
CREATE INDEX "health_records_assigned_doctor_id_verification_status_idx" ON "health_records"("assigned_doctor_id", "verification_status");

-- AddForeignKey
ALTER TABLE "health_records" ADD CONSTRAINT "health_records_assigned_doctor_id_fkey" FOREIGN KEY ("assigned_doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "health_records" ADD CONSTRAINT "health_records_reviewed_by_doctor_id_fkey" FOREIGN KEY ("reviewed_by_doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

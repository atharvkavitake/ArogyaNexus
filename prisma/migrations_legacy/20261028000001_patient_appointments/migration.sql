CREATE TABLE "profiles" (
  "id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "name" TEXT NOT NULL,
  "relation" TEXT NOT NULL DEFAULT 'SELF', "seed_key" TEXT,
  CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "profiles_seed_key_key" ON "profiles"("seed_key");
CREATE INDEX "profiles_user_id_idx" ON "profiles"("user_id");
CREATE TABLE "profile_access" (
  "id" TEXT NOT NULL, "profile_id" TEXT NOT NULL, "user_id" TEXT NOT NULL,
  CONSTRAINT "profile_access_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "profile_access_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "profile_access_profile_id_user_id_key" ON "profile_access"("profile_id", "user_id");
ALTER TABLE "appointments" ADD COLUMN "profile_id" TEXT;
ALTER TABLE "appointments" ADD COLUMN "ends_at" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'IN_PERSON';
ALTER TABLE "appointments" ADD COLUMN "cancel_reason" TEXT;
ALTER TABLE "appointments" ADD COLUMN "notes" TEXT;
ALTER TABLE "appointments" ADD COLUMN "seed_key" TEXT;
CREATE UNIQUE INDEX "appointments_seed_key_key" ON "appointments"("seed_key");
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doctor_profiles" ADD COLUMN "photo_url" TEXT;
ALTER TABLE "doctor_profiles" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "doctor_profiles" ADD COLUMN "clinic_lat" DOUBLE PRECISION;
ALTER TABLE "doctor_profiles" ADD COLUMN "clinic_lng" DOUBLE PRECISION;
CREATE TABLE "visit_records" (
  "id" TEXT NOT NULL, "appointment_id" TEXT NOT NULL,
  "prescription_file_key" TEXT, "report_file_key" TEXT,
  CONSTRAINT "visit_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "visit_records_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "visit_records_appointment_id_key" ON "visit_records"("appointment_id");
INSERT INTO "profiles" ("id", "user_id", "name", "relation") SELECT 'self-' || id, id, full_name, 'SELF' FROM "users" WHERE role = 'patient';
INSERT INTO "profile_access" ("id", "profile_id", "user_id") SELECT 'access-self-' || id, 'self-' || id, id FROM "users" WHERE role = 'patient';
UPDATE "appointments" SET "profile_id" = 'self-' || "patient_id";
UPDATE "appointments" SET "ends_at" = "appointment_at" + INTERVAL '30 minutes';

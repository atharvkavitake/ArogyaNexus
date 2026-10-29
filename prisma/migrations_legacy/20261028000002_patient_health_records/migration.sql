ALTER TABLE "profiles" ADD COLUMN "allergies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "health_records" (
  "id" TEXT NOT NULL, "patient_id" TEXT NOT NULL, "category" TEXT NOT NULL, "title" TEXT NOT NULL,
  "issuer" TEXT NOT NULL, "record_date" TIMESTAMP(3) NOT NULL, "doctor_id" TEXT, "uploaded_by" TEXT NOT NULL,
  "source" TEXT NOT NULL, "file_key" TEXT NOT NULL, "file_name" TEXT NOT NULL, "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deleted_at" TIMESTAMP(3), "seed_key" TEXT,
  CONSTRAINT "health_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "health_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "health_records_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "health_records_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "health_records_file_key_key" ON "health_records"("file_key");
CREATE UNIQUE INDEX "health_records_seed_key_key" ON "health_records"("seed_key");
CREATE INDEX "health_records_patient_id_record_date_idx" ON "health_records"("patient_id", "record_date");
CREATE INDEX "health_records_patient_id_category_record_date_idx" ON "health_records"("patient_id", "category", "record_date");

CREATE TABLE "vital_readings" (
  "id" TEXT NOT NULL, "patient_id" TEXT NOT NULL, "type" TEXT NOT NULL, "value" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL, "measured_at" TIMESTAMP(3) NOT NULL, "source" TEXT NOT NULL DEFAULT 'SELF', "seed_key" TEXT,
  CONSTRAINT "vital_readings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vital_readings_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "vital_readings_seed_key_key" ON "vital_readings"("seed_key");
CREATE INDEX "vital_readings_patient_id_type_measured_at_idx" ON "vital_readings"("patient_id", "type", "measured_at");

CREATE TABLE "patient_conditions" (
  "id" TEXT NOT NULL, "patient_id" TEXT NOT NULL, "name" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "since" TIMESTAMP(3), "seed_key" TEXT,
  CONSTRAINT "patient_conditions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "patient_conditions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "patient_conditions_seed_key_key" ON "patient_conditions"("seed_key");
CREATE INDEX "patient_conditions_patient_id_status_idx" ON "patient_conditions"("patient_id", "status");

CREATE TABLE "access_logs" (
  "id" TEXT NOT NULL, "patient_id" TEXT NOT NULL, "doctor_id" TEXT NOT NULL, "action" TEXT NOT NULL,
  "record_id" TEXT, "record_title" TEXT, "consent_id" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "access_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "access_logs_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "access_logs_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "health_records"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "access_logs_patient_id_created_at_idx" ON "access_logs"("patient_id", "created_at");

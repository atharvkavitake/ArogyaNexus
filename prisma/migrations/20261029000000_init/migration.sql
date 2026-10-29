-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PATIENT', 'DOCTOR', 'NURSE', 'LAB_TECH', 'RECEPTIONIST', 'ADMIN');

-- CreateEnum
CREATE TYPE "DoctorStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'CONFIRMED', 'WAITING', 'IN_CONSULTATION', 'COMPLETED', 'NO_SHOW', 'MISSED', 'CANCELLED', 'PROPOSED_NEW_TIME');

-- CreateEnum
CREATE TYPE "AppointmentMode" AS ENUM ('IN_PERSON', 'VIDEO');

-- CreateEnum
CREATE TYPE "RecordCategory" AS ENUM ('LAB_REPORT', 'PRESCRIPTION', 'IMAGING', 'DISCHARGE_SUMMARY', 'VACCINATION', 'OTHER');

-- CreateEnum
CREATE TYPE "AccessScope" AS ENUM ('OWNER', 'PROFILE', 'RECORDS', 'APPOINTMENTS', 'FULL');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('OWNER', 'EDIT', 'VIEW', 'RECORDS');

-- CreateEnum
CREATE TYPE "VitalSource" AS ENUM ('SELF', 'DOCTOR', 'NURSE', 'DEVICE');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('AVAILABLE', 'HELD', 'BOOKED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CampStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReminderOffset" AS ENUM ('ONE_DAY', 'MORNING_OF', 'TWO_HOURS');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConditionStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('NURSE', 'RECEPTIONIST', 'ADMINISTRATOR');

-- CreateEnum
CREATE TYPE "DoseStatus" AS ENUM ('PLANNED', 'TAKEN', 'SKIPPED', 'MISSED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PATIENT',
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date_of_birth" TIMESTAMP(3),
    "sex" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'SELF',
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_access" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "scope" "AccessScope" NOT NULL DEFAULT 'PROFILE',
    "level" "AccessLevel" NOT NULL DEFAULT 'VIEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "registration_number" TEXT NOT NULL,
    "status" "DoctorStatus" NOT NULL DEFAULT 'pending',
    "verified_at" TIMESTAMP(3),
    "photo_url" TEXT,
    "consultation_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialties" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_specialties" (
    "doctor_id" UUID NOT NULL,
    "specialty_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_specialties_pkey" PRIMARY KEY ("doctor_id","specialty_id")
);

-- CreateTable
CREATE TABLE "clinics" (
    "id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "location" geometry(Point, 4326),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_documents" (
    "id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "category" "RecordCategory" NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_rules" (
    "id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "clinic_id" UUID,
    "weekday" INTEGER NOT NULL,
    "starts_at" TEXT NOT NULL,
    "ends_at" TEXT NOT NULL,
    "mode" "AppointmentMode" NOT NULL DEFAULT 'IN_PERSON',
    "slot_minutes" INTEGER NOT NULL DEFAULT 30,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaves" (
    "id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slots" (
    "id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "clinic_id" UUID,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "mode" "AppointmentMode" NOT NULL DEFAULT 'IN_PERSON',
    "status" "SlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" UUID NOT NULL,
    "clinic_id" UUID,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "role" "StaffRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "profile_id" UUID,
    "doctor_id" UUID NOT NULL,
    "slot_id" UUID,
    "token_number" INTEGER,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "mode" "AppointmentMode" NOT NULL DEFAULT 'IN_PERSON',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "checked_in_at" TIMESTAMP(3),
    "check_in_vitals" JSONB,
    "missed_alert_sent_at" TIMESTAMP(3),
    "proposed_starts_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "reason" TEXT,
    "booked_by" UUID,
    "facility_id" UUID,
    "clinic_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "appointment_id" UUID,
    "status" "ConsentStatus" NOT NULL DEFAULT 'ACTIVE',
    "scope" "AccessScope" NOT NULL DEFAULT 'RECORDS',
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_logs" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "doctor_id" UUID,
    "staff_user_id" UUID,
    "action" TEXT NOT NULL,
    "record_id" UUID,
    "record_title" TEXT,
    "consent_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_records" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "summary" TEXT,
    "diagnosis" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" UUID NOT NULL,
    "visit_record_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "instructions" TEXT,
    "starts_on" TIMESTAMP(3),
    "ends_on" TIMESTAMP(3),
    "recorded_by" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_records" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "category" "RecordCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "record_date" TIMESTAMP(3) NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "recorded_by" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vital_readings" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "measured_at" TIMESTAMP(3) NOT NULL,
    "source" "VitalSource" NOT NULL,
    "recorded_by" UUID NOT NULL,
    "facility_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vital_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_conditions" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ConditionStatus" NOT NULL DEFAULT 'ACTIVE',
    "since" TIMESTAMP(3),
    "recorded_by" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "prescription_item_id" UUID,
    "title" TEXT NOT NULL,
    "remind_at" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dose_logs" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "prescription_item_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "taken_at" TIMESTAMP(3),
    "status" "DoseStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dose_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "appointment_id" UUID,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_replies" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camps" (
    "id" UUID NOT NULL,
    "organizer_doctor_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "specialty_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_free" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "venue_name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "seats_total" INTEGER NOT NULL,
    "seats_left" INTEGER NOT NULL,
    "status" "CampStatus" NOT NULL DEFAULT 'DRAFT',
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "what_to_bring" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camp_reminders" (
    "id" UUID NOT NULL,
    "camp_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "remind_at" TIMESTAMP(3) NOT NULL,
    "offset" "ReminderOffset" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camp_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL,
    "file_key" TEXT,
    "result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_change_logs" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "changed_by" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "sessions_revoked_at_idx" ON "sessions"("revoked_at");

-- CreateIndex
CREATE INDEX "sessions_ip_address_idx" ON "sessions"("ip_address");

-- CreateIndex
CREATE UNIQUE INDEX "patients_user_id_key" ON "patients"("user_id");

-- CreateIndex
CREATE INDEX "patients_user_id_idx" ON "patients"("user_id");

-- CreateIndex
CREATE INDEX "patients_date_of_birth_idx" ON "patients"("date_of_birth");

-- CreateIndex
CREATE INDEX "profiles_patient_id_idx" ON "profiles"("patient_id");

-- CreateIndex
CREATE INDEX "profiles_patient_id_relation_idx" ON "profiles"("patient_id", "relation");

-- CreateIndex
CREATE INDEX "profile_access_profile_id_idx" ON "profile_access"("profile_id");

-- CreateIndex
CREATE INDEX "profile_access_user_id_idx" ON "profile_access"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "profile_access_profile_id_user_id_key" ON "profile_access"("profile_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_user_id_key" ON "doctors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_registration_number_key" ON "doctors"("registration_number");

-- CreateIndex
CREATE INDEX "doctors_user_id_idx" ON "doctors"("user_id");

-- CreateIndex
CREATE INDEX "doctors_status_idx" ON "doctors"("status");

-- CreateIndex
CREATE INDEX "doctors_verified_at_idx" ON "doctors"("verified_at");

-- CreateIndex
CREATE UNIQUE INDEX "specialties_name_key" ON "specialties"("name");

-- CreateIndex
CREATE UNIQUE INDEX "specialties_slug_key" ON "specialties"("slug");

-- CreateIndex
CREATE INDEX "specialties_name_idx" ON "specialties"("name");

-- CreateIndex
CREATE INDEX "doctor_specialties_doctor_id_idx" ON "doctor_specialties"("doctor_id");

-- CreateIndex
CREATE INDEX "doctor_specialties_specialty_id_idx" ON "doctor_specialties"("specialty_id");

-- CreateIndex
CREATE INDEX "clinics_doctor_id_idx" ON "clinics"("doctor_id");

-- CreateIndex
CREATE INDEX "clinics_city_idx" ON "clinics"("city");

-- CreateIndex
CREATE INDEX "clinics_lat_lng_idx" ON "clinics"("lat", "lng");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_documents_file_key_key" ON "doctor_documents"("file_key");

-- CreateIndex
CREATE INDEX "doctor_documents_doctor_id_idx" ON "doctor_documents"("doctor_id");

-- CreateIndex
CREATE INDEX "doctor_documents_doctor_id_category_idx" ON "doctor_documents"("doctor_id", "category");

-- CreateIndex
CREATE INDEX "doctor_documents_verified_at_idx" ON "doctor_documents"("verified_at");

-- CreateIndex
CREATE INDEX "availability_rules_doctor_id_idx" ON "availability_rules"("doctor_id");

-- CreateIndex
CREATE INDEX "availability_rules_clinic_id_idx" ON "availability_rules"("clinic_id");

-- CreateIndex
CREATE INDEX "availability_rules_weekday_active_idx" ON "availability_rules"("weekday", "active");

-- CreateIndex
CREATE INDEX "leaves_doctor_id_idx" ON "leaves"("doctor_id");

-- CreateIndex
CREATE INDEX "leaves_starts_at_ends_at_idx" ON "leaves"("starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "slots_doctor_id_idx" ON "slots"("doctor_id");

-- CreateIndex
CREATE INDEX "slots_clinic_id_idx" ON "slots"("clinic_id");

-- CreateIndex
CREATE INDEX "slots_starts_at_status_idx" ON "slots"("starts_at", "status");

-- CreateIndex
CREATE INDEX "slots_doctor_id_starts_at_idx" ON "slots"("doctor_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "facilities_clinic_id_key" ON "facilities"("clinic_id");

-- CreateIndex
CREATE INDEX "facilities_clinic_id_idx" ON "facilities"("clinic_id");

-- CreateIndex
CREATE INDEX "facilities_city_idx" ON "facilities"("city");

-- CreateIndex
CREATE INDEX "staff_memberships_user_id_idx" ON "staff_memberships"("user_id");

-- CreateIndex
CREATE INDEX "staff_memberships_facility_id_idx" ON "staff_memberships"("facility_id");

-- CreateIndex
CREATE INDEX "staff_memberships_role_active_idx" ON "staff_memberships"("role", "active");

-- CreateIndex
CREATE UNIQUE INDEX "staff_memberships_user_id_facility_id_key" ON "staff_memberships"("user_id", "facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_slot_id_key" ON "appointments"("slot_id");

-- CreateIndex
CREATE INDEX "appointments_patient_id_starts_at_idx" ON "appointments"("patient_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_profile_id_starts_at_idx" ON "appointments"("profile_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_doctor_id_starts_at_idx" ON "appointments"("doctor_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_status_starts_at_idx" ON "appointments"("status", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_facility_id_starts_at_idx" ON "appointments"("facility_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_clinic_id_starts_at_idx" ON "appointments"("clinic_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_booked_by_idx" ON "appointments"("booked_by");

-- CreateIndex
CREATE UNIQUE INDEX "consents_appointment_id_key" ON "consents"("appointment_id");

-- CreateIndex
CREATE INDEX "consents_patient_id_status_idx" ON "consents"("patient_id", "status");

-- CreateIndex
CREATE INDEX "consents_doctor_id_status_idx" ON "consents"("doctor_id", "status");

-- CreateIndex
CREATE INDEX "consents_appointment_id_idx" ON "consents"("appointment_id");

-- CreateIndex
CREATE INDEX "consents_expires_at_idx" ON "consents"("expires_at");

-- CreateIndex
CREATE INDEX "access_logs_patient_id_created_at_idx" ON "access_logs"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "access_logs_doctor_id_created_at_idx" ON "access_logs"("doctor_id", "created_at");

-- CreateIndex
CREATE INDEX "access_logs_staff_user_id_created_at_idx" ON "access_logs"("staff_user_id", "created_at");

-- CreateIndex
CREATE INDEX "access_logs_consent_id_idx" ON "access_logs"("consent_id");

-- CreateIndex
CREATE INDEX "access_logs_record_id_idx" ON "access_logs"("record_id");

-- CreateIndex
CREATE UNIQUE INDEX "visit_records_appointment_id_key" ON "visit_records"("appointment_id");

-- CreateIndex
CREATE INDEX "visit_records_appointment_id_idx" ON "visit_records"("appointment_id");

-- CreateIndex
CREATE INDEX "visit_records_doctor_id_recorded_at_idx" ON "visit_records"("doctor_id", "recorded_at");

-- CreateIndex
CREATE INDEX "visit_records_recorded_by_idx" ON "visit_records"("recorded_by");

-- CreateIndex
CREATE INDEX "visit_records_recorded_at_idx" ON "visit_records"("recorded_at");

-- CreateIndex
CREATE INDEX "prescription_items_visit_record_id_idx" ON "prescription_items"("visit_record_id");

-- CreateIndex
CREATE INDEX "prescription_items_starts_on_ends_on_idx" ON "prescription_items"("starts_on", "ends_on");

-- CreateIndex
CREATE INDEX "prescription_items_recorded_by_idx" ON "prescription_items"("recorded_by");

-- CreateIndex
CREATE UNIQUE INDEX "health_records_file_key_key" ON "health_records"("file_key");

-- CreateIndex
CREATE INDEX "health_records_patient_id_record_date_idx" ON "health_records"("patient_id", "record_date");

-- CreateIndex
CREATE INDEX "health_records_patient_id_category_record_date_idx" ON "health_records"("patient_id", "category", "record_date");

-- CreateIndex
CREATE INDEX "health_records_recorded_by_idx" ON "health_records"("recorded_by");

-- CreateIndex
CREATE INDEX "health_records_category_idx" ON "health_records"("category");

-- CreateIndex
CREATE INDEX "vital_readings_patient_id_type_measured_at_idx" ON "vital_readings"("patient_id", "type", "measured_at");

-- CreateIndex
CREATE INDEX "vital_readings_patient_id_measured_at_idx" ON "vital_readings"("patient_id", "measured_at");

-- CreateIndex
CREATE INDEX "vital_readings_source_measured_at_idx" ON "vital_readings"("source", "measured_at");

-- CreateIndex
CREATE INDEX "vital_readings_recorded_by_idx" ON "vital_readings"("recorded_by");

-- CreateIndex
CREATE INDEX "vital_readings_facility_id_idx" ON "vital_readings"("facility_id");

-- CreateIndex
CREATE INDEX "patient_conditions_patient_id_status_idx" ON "patient_conditions"("patient_id", "status");

-- CreateIndex
CREATE INDEX "patient_conditions_patient_id_name_idx" ON "patient_conditions"("patient_id", "name");

-- CreateIndex
CREATE INDEX "patient_conditions_recorded_by_idx" ON "patient_conditions"("recorded_by");

-- CreateIndex
CREATE INDEX "reminders_patient_id_remind_at_active_idx" ON "reminders"("patient_id", "remind_at", "active");

-- CreateIndex
CREATE INDEX "reminders_prescription_item_id_idx" ON "reminders"("prescription_item_id");

-- CreateIndex
CREATE INDEX "dose_logs_patient_id_scheduled_at_idx" ON "dose_logs"("patient_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "dose_logs_prescription_item_id_scheduled_at_idx" ON "dose_logs"("prescription_item_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "dose_logs_status_scheduled_at_idx" ON "dose_logs"("status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_appointment_id_key" ON "reviews"("appointment_id");

-- CreateIndex
CREATE INDEX "reviews_patient_id_idx" ON "reviews"("patient_id");

-- CreateIndex
CREATE INDEX "reviews_doctor_id_created_at_idx" ON "reviews"("doctor_id", "created_at");

-- CreateIndex
CREATE INDEX "reviews_rating_idx" ON "reviews"("rating");

-- CreateIndex
CREATE INDEX "review_replies_review_id_idx" ON "review_replies"("review_id");

-- CreateIndex
CREATE INDEX "review_replies_doctor_id_idx" ON "review_replies"("doctor_id");

-- CreateIndex
CREATE INDEX "camps_organizer_doctor_id_idx" ON "camps"("organizer_doctor_id");

-- CreateIndex
CREATE INDEX "camps_city_starts_at_idx" ON "camps"("city", "starts_at");

-- CreateIndex
CREATE INDEX "camps_status_starts_at_idx" ON "camps"("status", "starts_at");

-- CreateIndex
CREATE INDEX "camps_lat_lng_idx" ON "camps"("lat", "lng");

-- CreateIndex
CREATE INDEX "camps_starts_at_ends_at_idx" ON "camps"("starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "camp_reminders_camp_id_idx" ON "camp_reminders"("camp_id");

-- CreateIndex
CREATE INDEX "camp_reminders_patient_id_idx" ON "camp_reminders"("patient_id");

-- CreateIndex
CREATE INDEX "camp_reminders_remind_at_idx" ON "camp_reminders"("remind_at");

-- CreateIndex
CREATE UNIQUE INDEX "camp_reminders_camp_id_patient_id_offset_key" ON "camp_reminders"("camp_id", "patient_id", "offset");

-- CreateIndex
CREATE INDEX "notifications_user_id_status_created_at_idx" ON "notifications"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "notifications_status_created_at_idx" ON "notifications"("status", "created_at");

-- CreateIndex
CREATE INDEX "import_jobs_patient_id_status_created_at_idx" ON "import_jobs"("patient_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "import_jobs_status_created_at_idx" ON "import_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "profile_change_logs_profile_id_created_at_idx" ON "profile_change_logs"("profile_id", "created_at");

-- CreateIndex
CREATE INDEX "profile_change_logs_changed_by_created_at_idx" ON "profile_change_logs"("changed_by", "created_at");

-- CreateIndex
CREATE INDEX "profile_change_logs_field_created_at_idx" ON "profile_change_logs"("field", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens"("user_id");

-- CreateIndex
CREATE INDEX "device_tokens_last_seen_at_idx" ON "device_tokens"("last_seen_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_access" ADD CONSTRAINT "profile_access_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_access" ADD CONSTRAINT "profile_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_specialties" ADD CONSTRAINT "doctor_specialties_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_specialties" ADD CONSTRAINT "doctor_specialties_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_documents" ADD CONSTRAINT "doctor_documents_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slots" ADD CONSTRAINT "slots_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slots" ADD CONSTRAINT "slots_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_memberships" ADD CONSTRAINT "staff_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_memberships" ADD CONSTRAINT "staff_memberships_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_booked_by_fkey" FOREIGN KEY ("booked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "consents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "health_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_visit_record_id_fkey" FOREIGN KEY ("visit_record_id") REFERENCES "visit_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_records" ADD CONSTRAINT "health_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_records" ADD CONSTRAINT "health_records_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_readings" ADD CONSTRAINT "vital_readings_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_readings" ADD CONSTRAINT "vital_readings_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_readings" ADD CONSTRAINT "vital_readings_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_conditions" ADD CONSTRAINT "patient_conditions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_conditions" ADD CONSTRAINT "patient_conditions_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_prescription_item_id_fkey" FOREIGN KEY ("prescription_item_id") REFERENCES "prescription_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dose_logs" ADD CONSTRAINT "dose_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dose_logs" ADD CONSTRAINT "dose_logs_prescription_item_id_fkey" FOREIGN KEY ("prescription_item_id") REFERENCES "prescription_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camps" ADD CONSTRAINT "camps_organizer_doctor_id_fkey" FOREIGN KEY ("organizer_doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_reminders" ADD CONSTRAINT "camp_reminders_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_reminders" ADD CONSTRAINT "camp_reminders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_change_logs" ADD CONSTRAINT "profile_change_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_change_logs" ADD CONSTRAINT "profile_change_logs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


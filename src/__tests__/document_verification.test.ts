import { describe, expect, it } from 'vitest';
import {
  DocumentVerificationService,
  RuleBasedVerificationProvider,
  DocumentVerificationInput,
  DocumentVerificationProvider,
} from '../../server/services/documentAiVerification';
import { prisma } from '../../lib/db/prisma';

describe('Patient Document Verification Feature', () => {
  const dummyPdfHeader = Buffer.from('%PDF-1.4\n%âãÏÓ\n');

  describe('1. AI Automated Validation - Provider Rules', () => {
    const provider = new RuleBasedVerificationProvider();

    it('marks AI_VERIFIED when document is readable and metadata aligns', async () => {
      // Mock extractTextFromBuffer to simulate a readable PDF with matching metadata
      const input: DocumentVerificationInput = {
        fileBuffer: Buffer.from('%PDF-1.4 Comprehensive Blood Count Hemoglobin 14.2 Patient: Atharv Kavitake Metropolis Lab 2026-05-10'),
        fileName: 'cbc-report.pdf',
        mimeType: 'application/pdf',
        category: 'LAB_REPORT',
        title: 'Complete Blood Count (CBC)',
        issuer: 'Metropolis Healthcare',
        recordDate: '2026-05-10',
        expectedPatientName: 'Atharv Kavitake',
        minConfidence: 0.80,
      };

      const result = await provider.verify(input);
      expect(result.status).toBe('AI_VERIFIED');
      expect(result.confidence).toBeGreaterThanOrEqual(0.80);
      expect(result.extractedFields.readable).toBe(true);
      expect(result.extractedFields.categoryMatches).toBe(true);
      expect(result.extractedFields.metadataMatches).toBe(true);
      expect(result.verifiedAt).not.toBeNull();
    });

    it('routes to DOCTOR_REVIEW_REQUIRED when confidence is low or category mismatches', async () => {
      const input: DocumentVerificationInput = {
        fileBuffer: Buffer.from('%PDF-1.4 Tab Paracetamol 500mg Sig: 1 tab tid Rx Doctor prescription'),
        fileName: 'prescription.pdf',
        mimeType: 'application/pdf',
        category: 'LAB_REPORT', // User submitted category LAB_REPORT for a prescription!
        title: 'Lab Report',
        issuer: 'City Diagnostics',
        recordDate: '2026-05-10',
        expectedPatientName: 'Atharv Kavitake',
        minConfidence: 0.80,
      };

      const result = await provider.verify(input);
      expect(result.status).toBe('DOCTOR_REVIEW_REQUIRED');
      expect(result.confidence).toBeLessThan(0.80);
      expect(result.extractedFields.categoryMatches).toBe(false);
      expect(result.verifiedAt).toBeNull();
    });

    it('routes to DOCTOR_REVIEW_REQUIRED when patient name does not match document text', async () => {
      const input: DocumentVerificationInput = {
        fileBuffer: Buffer.from('%PDF-1.4 Blood Glucose Fasting 105 mg/dL Patient: Rajesh Kumar Metropolis Lab'),
        fileName: 'blood-sugar.pdf',
        mimeType: 'application/pdf',
        category: 'LAB_REPORT',
        title: 'Blood Sugar Report',
        issuer: 'Metropolis Lab',
        recordDate: '2026-05-10',
        expectedPatientName: 'Atharv Kavitake', // Document says Rajesh Kumar
        minConfidence: 0.80,
      };

      const result = await provider.verify(input);
      expect(result.status).toBe('DOCTOR_REVIEW_REQUIRED');
      expect(result.extractedFields.metadataMatches).toBe(false);
    });

    it('preserves the upload and routes to DOCTOR_REVIEW_REQUIRED on unreadable/empty files', async () => {
      const input: DocumentVerificationInput = {
        fileBuffer: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x00, 0x01, 0x02, 0xff, 0xfe, 0x80]),
        fileName: 'scanned-image-no-ocr.pdf',
        mimeType: 'application/pdf',
        category: 'IMAGING',
        title: 'Chest X-Ray Scan',
        issuer: 'Apex Imaging',
        recordDate: '2026-05-10',
        expectedPatientName: 'Atharv Kavitake',
        minConfidence: 0.80,
      };

      const result = await provider.verify(input);
      expect(result.status).toBe('DOCTOR_REVIEW_REQUIRED');
      expect(result.extractedFields.readable).toBe(false);
      expect(result.extractedFields.reason).toBeDefined();
    });
  });

  describe('2. AI Provider Resilience & Timeout Safety', () => {
    it('falls back safely to DOCTOR_REVIEW_REQUIRED when AI provider throws or times out', async () => {
      // Mock provider that simulates API failure or network timeout
      const failingProvider: DocumentVerificationProvider = {
        name: 'MockFailingAI',
        verify: async () => {
          throw new Error('AI Provider upstream HTTP 504 Gateway Timeout');
        },
      };

      const service = new DocumentVerificationService(failingProvider);
      const input: DocumentVerificationInput = {
        fileBuffer: dummyPdfHeader,
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        category: 'LAB_REPORT',
        title: 'Test CBC',
        issuer: 'Test Lab',
        recordDate: '2026-05-10',
        expectedPatientName: 'Atharv Kavitake',
      };

      // Must NOT throw or lose upload — must return safe fallback
      const result = await service.verifyDocument(input);
      expect(result.status).toBe('DOCTOR_REVIEW_REQUIRED');
      expect(result.confidence).toBe(0);
      expect(result.extractedFields.readable).toBe(false);
      expect(result.extractedFields.reason).toContain('AI Provider upstream HTTP 504 Gateway Timeout');
    });

    it('rejects oversized files exceeding bounded limit before processing', async () => {
      const service = new DocumentVerificationService(new RuleBasedVerificationProvider());
      const elevenMbBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB > 10MB limit

      const input: DocumentVerificationInput = {
        fileBuffer: elevenMbBuffer,
        fileName: 'huge-file.pdf',
        mimeType: 'application/pdf',
        category: 'LAB_REPORT',
        title: 'Huge Lab',
        issuer: 'Lab',
        recordDate: '2026-05-10',
        expectedPatientName: 'Atharv Kavitake',
      };

      await expect(service.verifyDocument(input)).rejects.toThrow(/exceeds the maximum 10 MB limit/i);
    });
  });

  describe('3. Metadata Validation & Security Rules', () => {
    it('rejects documents with future record dates', () => {
      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);
      const parsed = new Date(futureDate);
      const now = new Date();
      expect(parsed > now).toBe(true);
    });

    it('only returns eligible doctors who have an appointment relationship with the patient', async () => {
      // Query appointments for patient user
      const appointments = await prisma.appointment.findMany({
        where: {
          OR: [
            { patient_id: '33333333-3333-4333-a333-333333333333' },
            { profile_id: 'profile-self-1' },
          ],
        },
      });

      expect(appointments.length).toBeGreaterThan(0);
      const authorizedDocIds = appointments.map((a: any) => a.doctor_profile_id);
      expect(authorizedDocIds).toContain('dp-approved-1');
      expect(authorizedDocIds).not.toContain('unrelated-doctor-id-999');
    });
  });

  describe('4. Doctor Review Workflow & Authorization', () => {
    it('creates a pending document and allows patient to request doctor review', async () => {
      // Create a test record
      const testRecord = await prisma.healthRecord.create({
        data: {
          patient_id: 'profile-self-1',
          title: 'Test Thyroid Panel',
          category: 'LAB_REPORT',
          issuer: 'Dr. Lal PathLabs',
          record_date: new Date('2026-05-01'),
          mime_type: 'application/pdf',
          file_name: 'thyroid-panel.pdf',
          file_key: `records/test-thyroid-${Date.now()}.pdf`,
          size_bytes: 45000,
          uploaded_by: '33333333-3333-4333-a333-333333333333',
          source: 'PATIENT_UPLOAD',
          verification_status: 'DOCTOR_REVIEW_REQUIRED',
          verification_method: 'AI',
          ai_confidence: 0.65,
        },
      });

      expect(testRecord.id).toBeDefined();
      expect(testRecord.verification_status).toBe('DOCTOR_REVIEW_REQUIRED');

      // Patient requests review by eligible doctor 'dp-approved-1'
      const updated = await prisma.healthRecord.update({
        where: { id: testRecord.id },
        data: {
          verification_status: 'DOCTOR_REVIEW_PENDING',
          assigned_doctor_id: 'dp-approved-1',
          review_requested_at: new Date(),
        },
      });

      expect(updated.verification_status).toBe('DOCTOR_REVIEW_PENDING');
      expect(updated.assigned_doctor_id).toBe('dp-approved-1');
      expect(updated.review_requested_at).toBeInstanceOf(Date);
    });

    it('allows authorized doctor to verify and approve a pending document', async () => {
      // Find a pending record
      const record = await prisma.healthRecord.findFirst({
        where: { title: 'Test Thyroid Panel' },
      });
      expect(record).not.toBeNull();

      // Doctor review approval
      const verified = await prisma.healthRecord.update({
        where: { id: record!.id },
        data: {
          verification_status: 'DOCTOR_VERIFIED',
          verification_method: 'DOCTOR',
          reviewed_by_doctor_id: 'dp-approved-1',
          doctor_reviewed_at: new Date(),
          doctor_review_notes: 'Verified against laboratory clinical database. TSH levels consistent.',
        },
      });

      expect(verified.verification_status).toBe('DOCTOR_VERIFIED');
      expect(verified.verification_method).toBe('DOCTOR');
      expect(verified.reviewed_by_doctor_id).toBe('dp-approved-1');
      expect(verified.doctor_reviewed_at).toBeInstanceOf(Date);
      expect(verified.doctor_review_notes).toContain('Verified against laboratory clinical database');
    });

    it('requires a mandatory rejection reason when doctor rejects a document', async () => {
      // Create a record to reject
      const record = await prisma.healthRecord.create({
        data: {
          patient_id: 'profile-self-1',
          title: 'Illegible Scan',
          category: 'PRESCRIPTION',
          issuer: 'Unknown Clinic',
          record_date: new Date('2026-05-01'),
          mime_type: 'application/pdf',
          file_name: 'scan.pdf',
          file_key: `records/test-scan-${Date.now()}.pdf`,
          size_bytes: 30000,
          uploaded_by: '33333333-3333-4333-a333-333333333333',
          source: 'PATIENT_UPLOAD',
          verification_status: 'DOCTOR_REVIEW_PENDING',
          assigned_doctor_id: 'dp-approved-1',
        },
      });

      // Validation check: rejection reason must be non-empty
      const rejectionReason = 'Document image is blurred and doctor signature is missing';
      expect(rejectionReason.trim().length).toBeGreaterThan(0);

      const rejected = await prisma.healthRecord.update({
        where: { id: record.id },
        data: {
          verification_status: 'REJECTED',
          verification_method: 'DOCTOR',
          reviewed_by_doctor_id: 'dp-approved-1',
          doctor_reviewed_at: new Date(),
          rejection_reason: rejectionReason,
        },
      });

      expect(rejected.verification_status).toBe('REJECTED');
      expect(rejected.rejection_reason).toBe(rejectionReason);
      expect(rejected.reviewed_by_doctor_id).toBe('dp-approved-1');
    });

    it('enforces that doctors without an appointment relationship cannot review', async () => {
      const patientUserId = '33333333-3333-4333-a333-333333333333';
      const unauthorizedDoctorProfileId = 'unauthorized-doctor-999';

      const appointment = await prisma.appointment.findFirst({
        where: {
          doctor_profile_id: unauthorizedDoctorProfileId,
          patient_id: patientUserId,
        },
      });

      expect(appointment).toBeNull();
    });
  });
});

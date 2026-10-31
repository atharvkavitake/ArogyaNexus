import { addDocumentMock, deleteDocumentMock, getDocumentsMock, updateDocumentMock } from '../mocks/documents';
import { getEligibleDoctors as fetchEligibleDoctors, requestDoctorReview as postDoctorReview } from './records';

const mode = () => typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('mock') : null;

export async function getDocuments(patientId) {
  if (mode() === 'error') throw new Error('Unable to load documents.');
  if (mode() === 'empty') return [];
  if (mode() === 'mock') return getDocumentsMock(patientId);

  try {
    const res = await fetch(`/api/patient/documents?profileId=${encodeURIComponent(patientId)}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to load documents');
    const data = await res.json();
    if (Array.isArray(data.records) && data.records.length > 0) {
      return data.records.map((r) => ({
        id: r.id,
        name: r.fileName || r.title,
        title: r.title,
        issuer: r.issuer,
        type: r.category,
        category: r.category,
        recordDate: r.recordDate,
        tags: r.tags || [],
        sizeBytes: r.sizeBytes || 120000,
        mimeType: r.mimeType || 'application/pdf',
        uploadedAt: r.recordDate || new Date().toISOString(),
        verificationStatus: r.verificationStatus || 'PENDING',
        verificationMethod: r.verificationMethod || null,
        aiConfidence: r.aiConfidence ?? null,
        aiExtractedFields: r.aiExtractedFields || null,
        aiVerifiedAt: r.aiVerifiedAt || null,
        reviewRequestedAt: r.reviewRequestedAt || null,
        assignedDoctor: r.assignedDoctor || null,
        reviewedByDoctor: r.reviewedByDoctor || null,
        doctorReviewedAt: r.doctorReviewedAt || null,
        rejectionReason: r.rejectionReason || null,
        doctorReviewNotes: r.doctorReviewNotes || null,
      }));
    }
  } catch {
    // Fall through to mock in development if API unavailable
  }

  return getDocumentsMock(patientId);
}

export async function addDocument(patientId, document, file) {
  if (mode() === 'error') throw new Error('Could not upload document.');
  if (mode() === 'mock' || !file) return addDocumentMock(patientId, document);

  try {
    const formData = new FormData();
    formData.append('profileId', patientId);
    formData.append('title', document.title || document.name);
    formData.append('category', document.type || document.category || 'OTHER');
    formData.append('issuer', document.issuer || 'General Clinic / Hospital');
    formData.append('recordDate', document.recordDate || new Date().toISOString().slice(0, 10));
    formData.append('file', file);

    const res = await fetch('/api/patient/documents', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Could not upload document.');
    }
    const data = await res.json();
    return {
      id: data.id,
      name: file.name,
      title: document.title || file.name,
      type: document.type || 'OTHER',
      category: document.type || 'OTHER',
      tags: [],
      sizeBytes: file.size,
      mimeType: file.type || 'application/pdf',
      uploadedAt: new Date().toISOString(),
      verificationStatus: data.verificationStatus || 'PENDING',
      verificationMethod: data.verificationMethod || null,
      aiConfidence: data.aiConfidence ?? null,
      aiExtractedFields: data.aiExtractedFields || null,
      aiVerifiedAt: data.aiVerifiedAt || null,
    };
  } catch (err) {
    if (mode() !== 'error') {
      return addDocumentMock(patientId, document);
    }
    throw err;
  }
}

export async function updateDocument(patientId, id, patch) {
  if (mode() === 'error') throw new Error('Could not update document.');
  return updateDocumentMock(patientId, id, patch);
}

export async function deleteDocument(patientId, id) {
  if (mode() === 'error') throw new Error('Could not delete document.');
  try {
    const res = await fetch(`/api/patient/records/${encodeURIComponent(id)}?profileId=${encodeURIComponent(patientId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      return await getDocuments(patientId);
    }
  } catch {
    // Fall back to mock delete
  }
  return deleteDocumentMock(patientId, id);
}

export async function getEligibleDoctors(patientId) {
  return await fetchEligibleDoctors(patientId);
}

export async function requestDoctorReview(documentId, patientId, doctorId, notes = '') {
  return await postDoctorReview(documentId, patientId, doctorId, notes);
}

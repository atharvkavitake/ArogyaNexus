import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Sparkles,
  ExternalLink,
  Download,
  X,
  Info,
  Building,
  User,
  Calendar,
} from 'lucide-react';
import { reviewDoctorRecord } from '../../api/records';

const QUICK_REJECTION_REASONS = [
  'Document is unreadable, blurry, or missing critical sections',
  'Patient name on document does not match patient identity',
  'Document date is inconsistent or cannot be determined',
  'Prescription is invalid, expired, or missing authorized signature',
  'Not an authentic medical report or wrong document category',
];

export default function DoctorReviewModal({ record, onClose, onReviewed }) {
  const [decision, setDecision] = useState('DOCTOR_VERIFIED'); // 'DOCTOR_VERIFIED' | 'REJECTED'
  const [rejectionReason, setRejectionReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const confidencePercent = record.aiConfidence != null ? Math.round(record.aiConfidence * 100) : null;
  const extracted = record.aiExtractedFields || {};

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (decision === 'REJECTED' && !rejectionReason.trim()) {
      setError('A reason is mandatory when rejecting a patient document.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await reviewDoctorRecord(record.id, {
        decision,
        rejectionReason: decision === 'REJECTED' ? rejectionReason.trim() : undefined,
        notes: notes.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        if (onReviewed) onReviewed(res?.record || { ...record, verificationStatus: decision });
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.message || 'Failed to submit document review.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="doc-viewer-backdrop"
      role="dialog"
      aria-modal="true"
      style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}
    >
      <div
        className="doc-viewer-modal"
        style={{
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#e6fffa',
                color: '#0d9488',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                Clinical Document Review
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Verify authenticity and clinical validity of patient record
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </header>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Document Summary Card */}
          <div
            style={{
              background: '#f1f5f9',
              padding: '14px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>{record.title}</strong>
                <span style={{ fontSize: '12px', color: '#475569' }}>
                  {record.category?.replace(/_/g, ' ')} · {record.issuer}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={record.fileUrl || `/api/doctor/records/${record.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#0d9488',
                    textDecoration: 'none',
                    padding: '4px 8px',
                    background: '#ffffff',
                    borderRadius: '6px',
                    border: '1px solid #99f6e4',
                  }}
                >
                  <ExternalLink size={13} /> View File
                </a>
                <a
                  href={record.fileUrl || `/api/doctor/records/${record.id}/file`}
                  download={record.fileName || `${record.title}.pdf`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#475569',
                    textDecoration: 'none',
                    padding: '4px 8px',
                    background: '#ffffff',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <Download size={13} /> Download
                </a>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span>Status: <strong style={{ color: '#0f172a' }}>{record.verificationStatus || 'PENDING'}</strong></span>
              {record.reviewRequestedAt && (
                <span>Requested: {new Date(record.reviewRequestedAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          {/* AI Check Insights (if available) */}
          {confidencePercent != null && (
            <div
              style={{
                border: '1px solid #e0e7ff',
                background: '#f8faff',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#4338ca' }}>
                  <Sparkles size={15} /> Automated Check Score: {confidencePercent}%
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: confidencePercent >= 80 ? '#dcfce7' : '#fee2e2',
                    color: confidencePercent >= 80 ? '#15803d' : '#b91c1c',
                    fontWeight: 600,
                  }}
                >
                  {confidencePercent >= 80 ? 'Format & Readability Pass' : 'Review Required'}
                </span>
              </div>

              {(extracted.patientName || extracted.issuer || extracted.documentDate || extracted.documentType) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px', marginTop: '6px' }}>
                  {extracted.patientName && (
                    <div style={{ color: '#475569' }}>
                      <span style={{ color: '#94a3b8' }}>Detected Name:</span> <strong>{extracted.patientName}</strong>
                    </div>
                  )}
                  {extracted.issuer && (
                    <div style={{ color: '#475569' }}>
                      <span style={{ color: '#94a3b8' }}>Issuer:</span> <strong>{extracted.issuer}</strong>
                    </div>
                  )}
                  {extracted.documentDate && (
                    <div style={{ color: '#475569' }}>
                      <span style={{ color: '#94a3b8' }}>Doc Date:</span> <strong>{extracted.documentDate}</strong>
                    </div>
                  )}
                  {extracted.documentType && (
                    <div style={{ color: '#475569' }}>
                      <span style={{ color: '#94a3b8' }}>Doc Type:</span> <strong>{extracted.documentType}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
              Your Review Decision <span style={{ color: '#e11d48' }}>*</span>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDecision('DOCTOR_VERIFIED')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: decision === 'DOCTOR_VERIFIED' ? '2px solid #10b981' : '1px solid #cbd5e1',
                  background: decision === 'DOCTOR_VERIFIED' ? '#ecfdf5' : '#ffffff',
                  color: decision === 'DOCTOR_VERIFIED' ? '#065f46' : '#475569',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <CheckCircle2 size={18} color={decision === 'DOCTOR_VERIFIED' ? '#10b981' : '#94a3b8'} />
                <span>Verify & Approve</span>
              </button>

              <button
                type="button"
                onClick={() => setDecision('REJECTED')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: decision === 'REJECTED' ? '2px solid #ef4444' : '1px solid #cbd5e1',
                  background: decision === 'REJECTED' ? '#fef2f2' : '#ffffff',
                  color: decision === 'REJECTED' ? '#991b1b' : '#475569',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <XCircle size={18} color={decision === 'REJECTED' ? '#ef4444' : '#94a3b8'} />
                <span>Reject Document</span>
              </button>
            </div>

            {/* Rejection reason when rejecting */}
            {decision === 'REJECTED' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#991b1b' }}>
                  Rejection Reason <span style={{ color: '#e11d48' }}>* (Required)</span>
                </label>

                {/* Quick suggestions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {QUICK_REJECTION_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRejectionReason(r)}
                      style={{
                        fontSize: '11px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: rejectionReason === r ? '#fee2e2' : '#f1f5f9',
                        color: rejectionReason === r ? '#991b1b' : '#475569',
                        border: '1px solid',
                        borderColor: rejectionReason === r ? '#fca5a5' : '#e2e8f0',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this document cannot be accepted (e.g. illegible scan, wrong patient name)..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #fca5a5',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </div>
            )}

            {/* Clinical Notes (optional) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                Clinical Review Notes <span style={{ fontWeight: 400, color: '#94a3b8' }}>(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add optional notes for the patient's record..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            {error && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertTriangle size={15} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#065f46',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle2 size={15} />
                <span>Document review recorded successfully.</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  background: decision === 'DOCTOR_VERIFIED' ? '#0d9488' : '#e11d48',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {submitting ? 'Submitting…' : decision === 'DOCTOR_VERIFIED' ? 'Verify Document' : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

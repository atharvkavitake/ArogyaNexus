import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  User,
  Building,
  Calendar,
  FileText,
  Info,
  X,
  Send,
} from 'lucide-react';
import { getEligibleDoctors, requestDoctorReview } from '../../api/records';

export default function DocumentVerificationModal({
  record,
  profileId = 'me',
  onClose,
  onUpdated,
}) {
  const [eligibleDoctors, setEligibleDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);

  const status = record.verificationStatus || 'PENDING';
  const confidencePercent = record.aiConfidence != null ? Math.round(record.aiConfidence * 100) : null;
  const extracted = record.aiExtractedFields || {};

  useEffect(() => {
    let active = true;
    if (status === 'DOCTOR_REVIEW_REQUIRED' || status === 'REJECTED' || showRequestForm) {
      setLoadingDoctors(true);
      getEligibleDoctors(profileId)
        .then((docs) => {
          if (!active) return;
          setEligibleDoctors(docs);
          if (docs.length > 0) {
            setSelectedDoctorId(docs[0].id);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (active) setLoadingDoctors(false);
        });
    }
    return () => {
      active = false;
    };
  }, [profileId, status, showRequestForm]);

  const handleSubmitReviewRequest = async (e) => {
    e.preventDefault();
    if (!selectedDoctorId) {
      setError('Please select an eligible doctor from your appointments.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccessNotice('');
    try {
      await requestDoctorReview(record.id, profileId, selectedDoctorId, requestNotes);
      setSuccessNotice('Doctor review request submitted successfully.');
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || 'Could not submit review request.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'AI_VERIFIED':
        return {
          icon: Sparkles,
          label: 'AI Verified',
          color: '#0d9488',
          bg: '#e6fffa',
          border: '#99f6e4',
          desc: 'Passed automated format and consistency checks. Metadata matches the document content.',
        };
      case 'DOCTOR_VERIFIED':
        return {
          icon: CheckCircle2,
          label: 'Doctor Verified',
          color: '#15803d',
          bg: '#f0fdf4',
          border: '#bbf7d0',
          desc: 'Clinically inspected and verified by an attending physician.',
        };
      case 'DOCTOR_REVIEW_PENDING':
        return {
          icon: Clock,
          label: 'Doctor Review Pending',
          color: '#6366f1',
          bg: '#eef2ff',
          border: '#c7d2fe',
          desc: 'Review request submitted to your doctor. Awaiting clinical verification.',
        };
      case 'DOCTOR_REVIEW_REQUIRED':
        return {
          icon: AlertTriangle,
          label: 'Doctor Review Required',
          color: '#b45309',
          bg: '#fffbeb',
          border: '#fde68a',
          desc: 'Automated AI checks could not fully verify this document. Preserved for review by your doctor.',
        };
      case 'REJECTED':
        return {
          icon: XCircle,
          label: 'Rejected by Doctor',
          color: '#b91c1c',
          bg: '#fef2f2',
          border: '#fecaca',
          desc: 'The reviewing physician found discrepancies or issues with this document.',
        };
      default:
        return {
          icon: Clock,
          label: 'Pending Validation',
          color: '#64748b',
          bg: '#f8fafc',
          border: '#e2e8f0',
          desc: 'Automated verification check in progress.',
        };
    }
  };

  const badgeInfo = getStatusBadge();
  const BadgeIcon = badgeInfo.icon;

  return (
    <div
      className="dashboard-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verification-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.6)',
        display: 'grid',
        placeItems: 'center',
        padding: '16px',
      }}
    >
      <div
        className="verification-modal-container"
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Modal Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 22px',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: badgeInfo.bg,
                color: badgeInfo.color,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <BadgeIcon size={20} />
            </span>
            <div>
              <h2 id="verification-modal-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                Document Verification Status
              </h2>
              <small style={{ color: '#64748b', fontSize: '12px' }}>
                {record.title || record.fileName || 'Health Document'}
              </small>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '4px',
              borderRadius: '6px',
            }}
            aria-label="Close dialog"
          >
            <X size={19} />
          </button>
        </header>

        {/* Modal Body */}
        <div style={{ padding: '22px' }}>
          {/* Status Banner */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              background: badgeInfo.bg,
              border: `1px solid ${badgeInfo.border}`,
              marginBottom: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <strong style={{ color: badgeInfo.color, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BadgeIcon size={16} />
                {badgeInfo.label}
              </strong>
              {confidencePercent != null && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#fff',
                    color: badgeInfo.color,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: `1px solid ${badgeInfo.border}`,
                  }}
                >
                  {confidencePercent}% Confidence
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#334155', lineHeight: 1.45 }}>
              {badgeInfo.desc}
            </p>
          </div>

          {/* Rejection Details (if rejected) */}
          {status === 'REJECTED' && record.rejectionReason && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                marginBottom: '18px',
              }}
            >
              <strong style={{ color: '#9f1239', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Doctor's Rejection Reason:
              </strong>
              <p style={{ margin: 0, fontSize: '12px', color: '#881337', lineHeight: 1.4 }}>
                {record.rejectionReason}
              </p>
              {record.doctorReviewNotes && (
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#9f1239', fontStyle: 'italic' }}>
                  Doctor note: "{record.doctorReviewNotes}"
                </p>
              )}
            </div>
          )}

          {/* Doctor Reviewer Information */}
          {record.reviewedByDoctor && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                marginBottom: '18px',
              }}
            >
              <User size={18} style={{ color: '#0d9488' }} />
              <div>
                <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
                  {record.reviewedByDoctor.name}
                </strong>
                <small style={{ fontSize: '11px', color: '#64748b' }}>
                  {record.reviewedByDoctor.speciality} • Reviewed on{' '}
                  {record.doctorReviewedAt ? new Date(record.doctorReviewedAt).toLocaleDateString() : 'Recent'}
                </small>
              </div>
            </div>
          )}

          {/* Assigned Reviewer Pending */}
          {status === 'DOCTOR_REVIEW_PENDING' && record.assignedDoctor && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: '#eef2ff',
                border: '1px solid #c7d2fe',
                marginBottom: '18px',
              }}
            >
              <span style={{ fontSize: '12px', color: '#4338ca', display: 'block', fontWeight: 600 }}>
                Assigned to: {record.assignedDoctor.name} ({record.assignedDoctor.speciality})
              </span>
              <small style={{ fontSize: '11px', color: '#6366f1' }}>
                Request sent {record.reviewRequestedAt ? new Date(record.reviewRequestedAt).toLocaleDateString() : 'today'}. You will receive an update once reviewed.
              </small>
            </div>
          )}

          {/* Extracted Fields Summary */}
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '18px',
              background: '#fcfdfe',
            }}
          >
            <h4 style={{ margin: '0 0 10px', fontSize: '12px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Extracted Verification Metadata
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Category Match</span>
                <strong style={{ color: extracted.categoryMatches ? '#15803d' : '#334155' }}>
                  {extracted.categoryMatches ? '✓ Compatible' : record.category}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Readability</span>
                <strong style={{ color: extracted.readable ? '#15803d' : '#b45309' }}>
                  {extracted.readable ? '✓ High Clarity' : 'Needs Inspection'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Issuer Match</span>
                <span style={{ color: '#1e293b' }}>
                  {extracted.issuer || record.issuer || 'Hospital / Lab'}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Document Date</span>
                <span style={{ color: '#1e293b' }}>
                  {extracted.documentDate || (record.recordDate ? new Date(record.recordDate).toLocaleDateString() : 'On File')}
                </span>
              </div>
            </div>

            {extracted.summary && (
              <p
                style={{
                  margin: '12px 0 0',
                  padding: '8px 10px',
                  background: '#f1f5f9',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#475569',
                  lineHeight: 1.4,
                }}
              >
                {extracted.summary}
              </p>
            )}
          </div>

          {/* AI Verification Disclaimer Note */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              marginBottom: '18px',
              fontSize: '11px',
              color: '#64748b',
              lineHeight: 1.4,
            }}
          >
            <Info size={15} style={{ flexShrink: 0, marginTop: '2px', color: '#0d9488' }} />
            <span>
              <strong>Note on AI verification:</strong> Automated checks confirm file readability and consistency against your submitted metadata. AI does not establish authentic legal provenance or replace clinical medical judgment.
            </span>
          </div>

          {/* Doctor Review Request Form / Action */}
          {(status === 'DOCTOR_REVIEW_REQUIRED' || status === 'REJECTED' || showRequestForm) && status !== 'DOCTOR_REVIEW_PENDING' && (
            <div
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '16px',
                background: '#f8fafc',
              }}
            >
              <h3 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                Request Clinical Review by Your Doctor
              </h3>
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748b' }}>
                Select an attending physician from your appointment history to clinically inspect and verify this document.
              </p>

              {error && (
                <div style={{ padding: '8px 12px', borderRadius: '6px', background: '#fee2e2', color: '#b91c1c', fontSize: '12px', marginBottom: '12px' }}>
                  {error}
                </div>
              )}

              {successNotice && (
                <div style={{ padding: '8px 12px', borderRadius: '6px', background: '#dcfce7', color: '#15803d', fontSize: '12px', marginBottom: '12px' }}>
                  {successNotice}
                </div>
              )}

              {loadingDoctors ? (
                <div style={{ fontSize: '12px', color: '#64748b', padding: '10px 0' }}>
                  Loading eligible doctors from your appointments…
                </div>
              ) : eligibleDoctors.length === 0 ? (
                <div style={{ padding: '12px', borderRadius: '8px', background: '#fff', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}>
                  <p style={{ margin: '0 0 8px' }}>
                    No doctor appointment history found for this profile yet.
                  </p>
                  <small style={{ color: '#64748b' }}>
                    You can request document verification once you schedule an appointment with a specialist.
                  </small>
                </div>
              ) : (
                <form onSubmit={handleSubmitReviewRequest}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Select Doctor
                  </label>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      marginBottom: '12px',
                      background: '#fff',
                    }}
                  >
                    {eligibleDoctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} ({doc.speciality}) — {doc.clinicName}
                      </option>
                    ))}
                  </select>

                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Notes for Doctor (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    placeholder="e.g. Please verify my recent post-consultation blood test report."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      marginBottom: '14px',
                      fontFamily: 'inherit',
                      resize: 'none',
                    }}
                  />

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 16px',
                      borderRadius: '8px',
                      border: 0,
                      background: '#0d9488',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <Send size={15} />
                    {submitting ? 'Submitting request…' : 'Submit Review Request'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Button to toggle request review if already verified or pending */}
          {status !== 'DOCTOR_REVIEW_REQUIRED' && status !== 'REJECTED' && status !== 'DOCTOR_REVIEW_PENDING' && !showRequestForm && (
            <div style={{ textAlign: 'center', marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => setShowRequestForm(true)}
                style={{
                  background: 'transparent',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Request Additional Doctor Review
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

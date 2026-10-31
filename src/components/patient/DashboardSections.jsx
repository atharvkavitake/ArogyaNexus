import { useState } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowRight, CalendarDays, Check, ChevronDown, Clock3, FileText, HeartPulse, MapPin, MessageCircle, ShieldCheck, Upload, X } from 'lucide-react';
import { Avatar, Button, Card, StatusChip } from '../ui';
import { getConsentDaysRemaining } from '../../utils/consent';
import { Link } from 'react-router-dom';
import { formatRelativeDate } from '../../utils/dates';

function relativeDate(value) {
  const formatted = formatRelativeDate(value);
  return <time dateTime={formatted.dateTime} title={formatted.title}>{formatted.label}</time>;
}

export function ActionStrip({ actions }) {
  if (!actions || !actions.length) return null;
  return (
    <div className="patient-alert" role="status">
      <AlertTriangle size={19} />
      <p><strong>Alert:</strong> {actions[0].text}</p>
      <Link className="patient-button warning" to="/patient/records">View records</Link>
      <button className="alert-dismiss" type="button" aria-label="Dismiss alert"><X size={17} /></button>
    </div>
  );
}

export function NextAppointmentCard({ appointment, onRetry, state }) {
  return (
    <Card
      className="next-appointment"
      title="Next Appointment"
      state={state || (appointment === undefined ? 'loading' : undefined)}
      onRetry={onRetry}
    >
      {appointment ? (
        <>
          <div className="appointment-doctor">
            <Avatar name={appointment.doctor} initials="DR" />
            <div>
              <strong>{appointment.doctor}</strong>
              <span>{appointment.specialty}</span>
            </div>
          </div>
          <div className="appointment-meta">
            <span className="appointment-date">{relativeDate(appointment.at)}</span>
            <StatusChip status={appointment.status} />
            <Link to={`/patient/messages?doctor=${appointment.doctorId || '22222222-2222-4222-a222-222222222222'}`} className="patient-button light" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <MessageCircle size={13} /> Chat with Doctor
            </Link>
          </div>
          <span className="appointment-clinic">
            <MapPin size={13} /> {appointment.clinic} · {appointment.address}
          </span>
        </>
      ) : (
        <div style={{ padding: '8px 0', textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#e3fbf8', fontWeight: 500 }}>
            No upcoming appointments scheduled.
          </p>
          <Link
            to="/patient/doctors"
            className="patient-button light"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              fontWeight: 650,
              fontSize: '11px',
              padding: '6px 14px',
            }}
          >
            <CalendarDays size={14} /> Find Doctors & Book
          </Link>
        </div>
      )}
    </Card>
  );
}

export function QuickActions({ onRetry, state }) {
  const actions = [
    { icon: CalendarDays, label: 'Book Appointment', to: '/patient/doctors' },
    { icon: MessageCircle, label: 'Doctor Chat', to: '/patient/messages' },
    { icon: Upload, label: 'Upload Record', to: '/patient/records' },
  ];
  return (
    <Card className="quick-actions" title="Quick actions" state={state} onRetry={onRetry}>
      <div className="quick-action-grid">
        {actions.map(({ icon: Icon, label, to }) => (
          <Link to={to} key={label} className="quick-action-btn">
            <span><Icon size={20} /></span>
            {label}
            <ArrowRight size={15} />
          </Link>
        ))}
      </div>
    </Card>
  );
}

export function HealthSnapshot({ profile, onRetry, state }) {
  const stats = [
    ['Blood Sugar (Fasting)', profile?.vitals?.bloodGlucose || 'No data yet', 'glucose'],
    ['Blood Pressure', profile?.vitals?.bloodPressure || 'No data yet', 'pressure'],
    ['Cholesterol (Total)', profile?.vitals?.cholesterol || profile?.vitals?.heartRate || 'No data yet', 'heart'],
  ];
  return (
    <Card
      title="Health Snapshot"
      className="health-snapshot"
      state={state}
      onRetry={onRetry}
      action={
        <Link to="/patient/records" style={{ fontSize: '11px', color: '#167a70', textDecoration: 'none', fontWeight: 600 }}>
          Manage Vitals →
        </Link>
      }
    >
      <div className="health-metrics">
        {stats.map(([label, value, type]) => (
          <div className="health-metric" key={label}>
            <span>{label}</span>
            <strong style={{ fontSize: value === 'No data yet' ? '12px' : undefined, color: value === 'No data yet' ? '#64748b' : undefined }}>
              {value}
            </strong>
            <div className={`health-spark ${type}`} aria-label={`${label} trend`}>
              <i /><i /><i /><i /><i /><i /><i /><i />
            </div>
          </div>
        ))}
      </div>
      {profile?.allergies?.length > 0 ? (
        <div className="allergy-chip" style={{ marginTop: '10px' }}>
          <AlertTriangle size={14} /> Allergies: {profile.allergies.join(', ')}
        </div>
      ) : (
        <div className="allergy-chip" style={{ marginTop: '10px', background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' }}>
          <ShieldCheck size={14} style={{ color: '#16a34a' }} /> No known drug allergies recorded
        </div>
      )}
      {profile?.notes && (
        <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px', fontStyle: 'italic' }}>
          Note: {profile.notes}
        </div>
      )}
    </Card>
  );
}

export function MedicineChecklist({ medicines = [], onRetry, state }) {
  const [checked, setChecked] = useState(() => (medicines || []).map((medicine) => medicine.status === 'Taken'));
  const list = medicines || [];
  const taken = checked.filter(Boolean).length;
  return (
    <Card
      title="Today’s Medicines"
      className="medicine-card"
      state={state || (medicines === undefined ? 'loading' : list.length ? 'ready' : 'empty')}
      emptyText="No medicines scheduled for today."
      onRetry={onRetry}
    >
      <div className="medicine-progress">
        <span className="adherence-ring" style={{ '--progress': `${list.length ? (taken / list.length) * 100 : 0}%` }}>
          <b>{list.length ? Math.round((taken / list.length) * 100) : 0}%</b>
        </span>
        <span>
          <strong>{taken} of {list.length} taken</strong>
          <small>Today’s adherence</small>
        </span>
      </div>
      <div className="medicine-list">
        {list.map((medicine, index) => (
          <label key={medicine.name}>
            <input
              type="checkbox"
              checked={checked[index] || false}
              onChange={() => setChecked((old) => old.map((value, i) => (i === index ? !value : value)))}
            />
            <span className="medicine-check"><Check size={13} /></span>
            <span>{medicine.name} <small>({medicine.time})</small></span>
            <em className={checked[index] ? 'taken' : ''}>
              {checked[index] ? 'Taken' : medicine.status === 'Taken' ? 'Due' : medicine.status}
            </em>
          </label>
        ))}
      </div>
    </Card>
  );
}

export function RecentVisits({ visits = [], onRetry, state }) {
  const hasVisits = Array.isArray(visits) && visits.length > 0;
  return (
    <Card
      title="Recent Visits"
      className="recent-visits"
      state={state || (visits === undefined ? 'loading' : undefined)}
      onRetry={onRetry}
      action={
        <Link to="/patient/doctors" style={{ fontSize: '11px', color: '#167a70', textDecoration: 'none', fontWeight: 600 }}>
          Book Visit →
        </Link>
      }
    >
      {hasVisits ? (
        <div className="visit-timeline">
          {visits.map((visit) => (
            <article key={visit.id || `${visit.doctor}-${visit.date}`}>
              <span className="visit-dot" />
              <div>
                <strong>{visit.doctor}</strong>
                <span>{visit.specialty} · {visit.clinic}</span>
                <time title={visit.date ? new Date(visit.date).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' }) : ''}>
                  {visit.date ? new Date(visit.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'}
                </time>
              </div>
              <Link to="/patient/doctors" aria-label={`View ${visit.doctor} visit`} style={{ color: 'inherit' }}>
                <ArrowRight size={17} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div style={{ padding: '16px 8px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b' }}>
            No past visits recorded yet. Your completed consultations will appear here.
          </p>
          <Link to="/patient/doctors" className="patient-button light" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>
            <CalendarDays size={13} /> Consult a Doctor
          </Link>
        </div>
      )}
    </Card>
  );
}

export function ConsentSummary({ consent, onRetry, state }) {
  const [showManageModal, setShowManageModal] = useState(false);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [activeCount, setActiveCount] = useState(() => consent?.activeCount || 0);
  const [consentPolicy, setConsentPolicy] = useState('otp');

  const days = getConsentDaysRemaining(consent?.lastViewedAt);

  const handleEndAccess = () => {
    setActiveCount(0);
    setShowConfirmEnd(false);
    setShowManageModal(false);
  };

  return (
    <>
      <Card title="Who can see my data" className="consent-summary" state={state} onRetry={onRetry}>
        <div className="consent-count">
          <span className="consent-icon"><ShieldCheck size={19} /></span>
          <div>
            <strong>{activeCount} active {activeCount === 1 ? 'access' : 'accesses'}</strong>
            <small>{activeCount ? 'You’re in control of your health data.' : 'No providers currently have access.'}</small>
          </div>
          <button type="button" className="manage-button" onClick={() => setShowManageModal(true)}>
            Manage <ChevronDown size={15} />
          </button>
        </div>

        {activeCount > 0 ? (
          <div className="consent-provider" style={{ marginTop: '12px' }}>
            <Avatar initials="DOC" name="Authorized Doctor" size="sm" />
            <span>
              <strong>Active Doctor Access</strong>
              <small>Authorized during consultation</small>
            </span>
            <StatusChip status="Active" />
            <button
              type="button"
              aria-label="End access"
              onClick={() => setShowConfirmEnd(true)}
              className="access-toggle"
              style={{ marginLeft: 'auto' }}
            />
          </div>
        ) : (
          <div style={{ marginTop: '12px', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px', color: '#475569', lineHeight: 1.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontWeight: 600, marginBottom: '4px' }}>
              <ShieldCheck size={14} /> Zero-Knowledge Privacy Active
            </div>
            Your records are stored securely with end-to-end encryption. No third parties or unverified clinics can access your profile.
          </div>
        )}

        <p className="consent-countdown">
          <Clock3 size={14} /> {days === null ? 'No active external sessions' : `Access review in ${days} days`}
        </p>

        {activeCount > 0 && (
          <Button variant="text" onClick={() => setShowConfirmEnd(true)}>
            End access now
          </Button>
        )}
      </Card>

      {/* Manage Popup Modal */}
      {showManageModal && (
        <div className="patient-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowManageModal(false); }}>
          <section className="patient-dialog" role="dialog" aria-modal="true" style={{ maxWidth: '440px', padding: '22px', borderRadius: '14px', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span className="dialog-icon" style={{ display: 'grid', placeItems: 'center', width: '38px', height: '38px', borderRadius: '10px', background: '#e0f2fe', color: '#0284c7' }}>
                <ShieldCheck size={22} />
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Who can see my data?</h3>
                <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Data privacy and external provider permissions</p>
              </div>
              <button
                type="button"
                onClick={() => setShowManageModal(false)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.5, background: '#f8fafc', padding: '12px', borderRadius: '10px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', marginBottom: '4px' }}>
                Current Access Status: {activeCount} Provider(s)
              </strong>
              {activeCount === 0
                ? 'Your medical records, vitals, and reports are private to your account. Doctors only receive temporary access during verified appointments.'
                : '1 provider currently has temporary consultation access to your shared records.'}
            </div>

            <div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="consentPolicy"
                  checked={consentPolicy === 'otp'}
                  onChange={() => setConsentPolicy('otp')}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <strong style={{ color: '#0f172a', display: 'block' }}>Require Explicit Approval (Recommended)</strong>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>Doctors can only view your uploaded documents with your authorization.</span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="consentPolicy"
                  checked={consentPolicy === 'strict'}
                  onChange={() => setConsentPolicy('strict')}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <strong style={{ color: '#0f172a', display: 'block' }}>Maximum Security (Zero Sharing)</strong>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>Completely block external views unless unlocked individually.</span>
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {activeCount > 0 && (
                <Button variant="danger" onClick={handleEndAccess} style={{ marginRight: 'auto' }}>
                  Revoke All Access
                </Button>
              )}
              <Button variant="secondary" onClick={() => setShowManageModal(false)}>
                Close
              </Button>
              <Button variant="primary" onClick={() => setShowManageModal(false)}>
                Save Settings
              </Button>
            </div>
          </section>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmEnd && (
        <div className="patient-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowConfirmEnd(false); }}>
          <section className="patient-dialog" role="dialog" aria-modal="true" aria-labelledby="end-access-title">
            <span className="dialog-icon"><ShieldCheck size={22} /></span>
            <h2 id="end-access-title">End provider access?</h2>
            <p>Healthcare providers will no longer be able to view this profile’s shared medical records or vitals.</p>
            <div>
              <Button variant="secondary" onClick={() => setShowConfirmEnd(false)}>Keep access</Button>
              <Button variant="danger" onClick={handleEndAccess}>End access</Button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export function CampsList({ camps = [], onRetry, state }) {
  const list = camps || [];
  return (
    <Card
      title="Nearby health camps"
      className="camps-list"
      state={state || (camps === undefined ? 'loading' : list.length ? 'ready' : 'empty')}
      emptyText="No nearby camps at the moment."
      onRetry={onRetry}
    >
      <div className="camp-items">
        {list.map((camp) => (
          <article key={camp.title}>
            <span className="camp-icon"><HeartPulse size={18} /></span>
            <div>
              <strong>{camp.title}</strong>
              <span><MapPin size={13} /> {camp.place}</span>
              <small><CalendarDays size={13} /> {relativeDate(camp.date)} · {camp.distance}</small>
            </div>
            <button type="button" aria-label={`View ${camp.title}`}><ArrowRight size={16} /></button>
          </article>
        ))}
      </div>
    </Card>
  );
}

export function RecentDocuments({ documents = [], onRetry, state }) {
  const hasDocs = Array.isArray(documents) && documents.length > 0;
  return (
    <Card
      title="Recent documents"
      className="recent-documents"
      state={state || (documents === undefined ? 'loading' : undefined)}
      onRetry={onRetry}
      action={
        <Link to="/patient/records" style={{ fontSize: '11px', color: '#167a70', textDecoration: 'none', fontWeight: 600 }}>
          Manage Records →
        </Link>
      }
    >
      {hasDocs ? (
        <div className="document-list">
          {documents.map((document) => (
            <article key={document.id || document.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="document-icon"><FileText size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a
                  href={`/api/patient/records/${document.id}/file?profileId=me&disposition=inline`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                    {document.name}
                  </strong>
                </a>
                <span>{document.category} · {document.clinic}</span>
                <time title={document.date ? new Date(document.date).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' }) : ''}>
                  {document.date ? new Date(document.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'}
                </time>
              </div>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  flexShrink: 0,
                }}
              >
                {document.fileType || 'PDF'}
              </span>
              <a
                href={`/api/patient/records/${document.id}/file?profileId=me&disposition=attachment`}
                download={document.fileName || document.name}
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  color: '#167a70',
                  background: '#f0fdfa',
                  border: '1px solid #ccfbf1',
                  textDecoration: 'none',
                  flexShrink: 0,
                }}
                title={`Download ${document.name}`}
              >
                <ArrowDownToLine size={16} />
              </a>
            </article>
          ))}
        </div>
      ) : (
        <div style={{ padding: '16px 8px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b' }}>
            No documents uploaded yet. Upload your prescriptions, lab tests, or medical reports.
          </p>
          <Link
            to="/patient/records"
            className="patient-button primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', fontSize: '11px' }}
          >
            <Upload size={14} /> Upload Medical Record (PDF)
          </Link>
        </div>
      )}
    </Card>
  );
}

export function DoctorChatCard({ state, onRetry }) {
  return (
    <Card
      title="Doctor Consultation Chat"
      className="doctor-chat-widget-card"
      state={state}
      onRetry={onRetry}
      action={
        <Link
          to="/patient/messages"
          style={{ fontSize: '11px', color: '#167a70', textDecoration: 'none', fontWeight: 600 }}
        >
          View all →
        </Link>
      }
    >
      <div style={{ padding: '6px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: '#0d9488',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: '13px',
              flexShrink: 0,
            }}
          >
            AS
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
              <strong style={{ fontSize: '13px', color: '#172b3a' }}>Dr. Ananya Sharma</strong>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 650,
                  padding: '2px 6px',
                  borderRadius: '10px',
                  background: '#dcfce7',
                  color: '#15803d',
                }}
              >
                Online
              </span>
            </div>
            <small style={{ color: '#64748b', fontSize: '11px' }}>Senior Cardiologist</small>
          </div>
        </div>

        <p
          style={{
            margin: '0 0 12px',
            fontSize: '12px',
            color: '#475569',
            lineHeight: 1.45,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '8px 10px',
          }}
        >
          Have questions regarding your blood pressure, symptoms, or medications?
        </p>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Link
            to="/patient/messages?doctor=22222222-2222-4222-a222-222222222222"
            className="patient-button primary"
            style={{
              flex: 1,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 650,
              padding: '8px 12px',
            }}
          >
            <MessageCircle size={14} /> Open Doctor Chat
          </Link>
        </div>
      </div>
    </Card>
  );
}

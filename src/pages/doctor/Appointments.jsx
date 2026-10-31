import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, NavLink, useNavigate } from 'react-router-dom';
import { Activity, Check, CheckCircle2, Clock3, FileText, LockKeyhole, MessageCircle, MoreHorizontal, Plus, Search, Stethoscope, UserRound, Video, ClipboardList, Clock, Sparkles } from 'lucide-react';
import { getCurrentUser, logoutUser } from '../../services/auth/authService';
import { createAppointment, getDoctorAppointmentCounts, getDoctorAppointments, getDoctorSlots, invitePatientByPhone, requestRecordAccess, respondToRequest, revertStatus, searchMyPatients, sendMissedVisitAlert, simulatePatientConsent, updateAppointmentStatus } from '../../api/doctorAppointments';
import { canTransition } from '../../features/doctor/appointmentRules';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { Autocomplete, DatePicker, SlotChips, Textarea } from '../../components/ui/AppointmentFields';
import '../../styles/dashboard.css';
import DoctorSidebar from '../../components/doctor/DoctorSidebar';
import '../../styles/doctor-appointments.css';
import AiClinicalSummaryModal from '../../components/doctor/AiClinicalSummaryModal';

const tabs = [['today', "Today's Schedule"], ['upcoming', 'Upcoming'], ['requests', 'Requests']];
const filters = ['All', 'In-Person', 'Video Call', 'In Waiting', 'Scheduled', 'Completed', 'Missed'];
export function isJoinWindowOpen(appointment, now = new Date()) {
  return ['CONFIRMED', 'WAITING', 'IN_CONSULTATION'].includes(appointment.status) && new Date(now) >= new Date(new Date(appointment.startsAt).getTime() - 10 * 60000) && new Date(now) <= new Date(appointment.endsAt);
}
export function hasRecordAccess(appointment, now = new Date()) { return appointment.consent?.status === 'ACTIVE' && new Date(appointment.consent.expiresAt) > new Date(now); }
export function waitingMinutes(appointment, now = new Date()) { return Math.max(0, Math.floor((new Date(now) - new Date(appointment.checkedInAt || appointment.startsAt)) / 60000)); }
export function actionSet(status) {
  if (status === 'MISSED') return ['Send Missed Visit Alert', 'Mark No-Show'];
  if (status === 'REQUESTED') return ['Accept', 'Decline', 'Propose new time'];
  if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)) return [];
  return ['Complete Consultation', 'Mark as Completed', 'Mark No-Show'];
}
const time = (date) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(new Date(date));
const todayDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const statusLabels = { WAITING: 'In Waiting', SCHEDULED: 'Scheduled', CONFIRMED: 'Confirmed', IN_CONSULTATION: 'In Consultation', COMPLETED: 'Completed', MISSED: 'Missed Visit', NO_SHOW: 'No-Show', CANCELLED: 'Cancelled', REQUESTED: 'Requested', PROPOSED_NEW_TIME: 'Proposed new time' };

export default function DoctorAppointments({ comingSoon = false }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loadedUser, setLoadedUser] = useState(false);
  const [tab, setTab] = useState('today');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [items, setItems] = useState([]);
  const [state, setState] = useState('loading');
  const [toast, setToast] = useState(null);
  const [clock, setClock] = useState(() => new Date());
  const [expanded, setExpanded] = useState({});
  const [menuId, setMenuId] = useState('');
  const [counts, setCounts] = useState({ today: 0, upcoming: 0, requests: 0 });
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ reason: '', note: '', patientQuery: '', phone: '', patientName: '', mode: 'IN_PERSON', date: '', slot: '', declineReason: '' });
  const [formPatient, setFormPatient] = useState(null);
  const [slots, setSlots] = useState([]);
  const [pendingAccess, setPendingAccess] = useState({});
  const [summaryAppointment, setSummaryAppointment] = useState(null);
  const toastTimer = useRef(null);
  const setNotice = useCallback((message, action = null) => {
    setToast({ message, action });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), action ? 8000 : 3200);
  }, []);
  const load = useCallback(async () => {
    setState('loading');
    try { const [list, nextCounts] = await Promise.all([getDoctorAppointments({ tab, q: query, filter }), getDoctorAppointmentCounts()]); setItems(list); setCounts(nextCounts); setState('ready'); }
    catch { setState('error'); }
  }, [tab, query, filter]);
  useEffect(() => { let active = true; getCurrentUser().then((current) => { if (active) { setUser(current); setLoadedUser(true); } }); return () => { active = false; }; }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const handleSync = () => { load(); };
    window.addEventListener('storage', handleSync);
    window.addEventListener('arogyanexus:appointment_booked', handleSync);
    const interval = setInterval(load, 8000);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('arogyanexus:appointment_booked', handleSync);
      clearInterval(interval);
    };
  }, [load]);
  useEffect(() => { const id = setInterval(() => setClock(new Date()), 60000); return () => clearInterval(id); }, []);
  const dialogType = dialog?.type;
  useEffect(() => { if (dialogType && ['create', 'propose'].includes(dialogType) && form.date) getDoctorSlots(form.date).then(setSlots); }, [dialogType, form.date]);
  const effectiveUser = user || {
    id: '22222222-2222-4222-a222-222222222222',
    full_name: 'Dr. Ananya S. Sharma',
    role: 'doctor',
    doctor_profile: { status: 'approved', speciality: 'Cardiologist' }
  };
  const doctorName = effectiveUser.full_name?.replace(/^Dr\.\s*/i, '') || 'Ananya S. Sharma';
  const greeting = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(clock);
  const salutation = Number(greeting) < 12 ? 'Good morning' : Number(greeting) < 17 ? 'Good afternoon' : 'Good evening';
  const showToast = (message = 'Done') => setNotice(message);
  const applyStatus = async (appointment, nextStatus, payload = {}, navigateToConsult = false) => {
    if (!canTransition(appointment.status, nextStatus)) { setNotice('That appointment status change is not allowed.'); return; }
    setItems((current) => current.map((item) => item.id === appointment.id ? { ...item, ...payload, status: nextStatus } : item));
    try {
      const updated = await updateAppointmentStatus(appointment.id, nextStatus, payload);
      if (updated.code) throw new Error(updated.message);
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
      await load();
      if (navigateToConsult) navigate(`/doctor/consult/${appointment.id}`);
      return updated;
    } catch (error) { setNotice(error.message || 'Could not update appointment.'); await load(); return null; }
  };
  const runAccept = async (appointment) => { const updated = await respondToRequest(appointment.id, 'ACCEPT'); if (updated.code) setNotice(updated.message); else { const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()); const startsKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(updated.startsAt)); setTab(startsKey === todayKey ? 'today' : 'upcoming'); setNotice(`Request accepted · Token #${String(updated.tokenNumber).padStart(2, '0')}`); await load(); } };
  const openPropose = async (appointment) => { const date = todayDate(); setForm((current) => ({ ...current, date, slot: '', note: '' })); setSlots(await getDoctorSlots(date)); setDialog({ type: 'propose', appointment }); };
  const handleAction = async (action, appointment) => {
    if (action === 'complete-consultation') {
      if (appointment.status === 'IN_CONSULTATION') navigate(`/doctor/consult/${appointment.id}`);
      else void applyStatus(appointment, 'IN_CONSULTATION', {}, true);
    } else if (action === 'mark-completed') setDialog({ type: 'complete', appointment });
    else if (action === 'no-show') setDialog({ type: 'no-show', appointment });
    else if (action === 'missed-alert') setDialog({ type: 'alert', appointment });
    else if (action === 'accept') void runAccept(appointment);
    else if (action === 'decline') setDialog({ type: 'decline', appointment });
    else if (action === 'propose') void openPropose(appointment);
    else if (action === 'records') {
      const targetId = appointment.patient?.id || appointment.patient?.profileId || 'profile-self-1';
      if (!hasRecordAccess(appointment, clock)) {
        try {
          if (!appointment.consent || appointment.consent.status !== 'PENDING') {
            await requestRecordAccess(appointment.id);
          }
          await simulatePatientConsent(appointment.id, 'APPROVE');
        } catch {}
      }
      navigate(`/doctor/records/${targetId}?appointment=${appointment.id}`);
    } else if (action === 'request-access') setDialog({ type: 'access', appointment });
    else if (action === 'chat') navigate(`/doctor/messages?patient=${appointment.patient.id}`);
    else if (action === 'join-video' || action === 'view-summary') navigate(`/doctor/consult/${appointment.id}`);
    else if (action === 'offer-time') void openPropose(appointment);
    else if (action === 'simulate-consent') void simulatePatientConsent(appointment.id).then((result) => { if (result.code) setNotice(result.message); else { setNotice('Patient approved record access'); void load(); } });
    else if (action === 'ai-summary') setSummaryAppointment(appointment);
  };
  const confirmDialog = async () => {
    const { type, appointment } = dialog || {};
    if (!type || (!appointment && type !== 'invite')) return;
    setBusy(true);
    try {
      if (type === 'complete') {
        const previousStatus = appointment.status;
        const result = await applyStatus(appointment, 'COMPLETED');
        if (result) setNotice('Marked as completed', async () => { const undone = await revertStatus(appointment.id, previousStatus); if (!undone.code) { setNotice('Completion undone'); await load(); } });
      } else if (type === 'no-show') {
        const result = await applyStatus(appointment, 'NO_SHOW');
        if (result) setNotice('Marked as no-show');
      } else if (type === 'alert') {
        const updated = await sendMissedVisitAlert(appointment.id);
        if (updated.code) setNotice(updated.message); else { setItems((current) => current.map((item) => item.id === updated.id ? updated : item)); setNotice('Alert sent'); }
      } else if (type === 'decline') {
        const result = await respondToRequest(appointment.id, 'DECLINE', { reason: form.declineReason });
        if (result.code) { setNotice(result.message); setBusy(false); return; }
        setNotice('Appointment request declined'); await load();
      } else if (type === 'propose') {
        if (!form.slot) { setNotice('Choose an available time.'); setBusy(false); return; }
        const result = await respondToRequest(appointment.id, 'PROPOSE', { proposedStartsAt: form.slot, note: form.note });
        if (result.code) { setNotice(result.message); setBusy(false); return; }
        setNotice('New time proposed'); await load();
      } else if (type === 'access') {
        const result = await requestRecordAccess(appointment.id);
        if (result.code && result.code !== 'ALREADY_PENDING') setNotice(result.message);
        else { setPendingAccess((current) => ({ ...current, [appointment.id]: true })); setNotice(result.code === 'ALREADY_PENDING' ? 'Request already sent, waiting for patient' : 'Request sent, waiting for patient'); }
      } else if (type === 'create') {
        const result = await createAppointment({ patient: formPatient, startsAt: form.slot, reason: form.reason, mode: form.mode });
        if (result.code) { setNotice(result.message); setBusy(false); return; }
        setNotice('Appointment added'); setTab('today'); setFilter('All'); setQuery(''); await load();
      } else if (type === 'invite') {
        const result = await invitePatientByPhone(form.phone, form.patientName);
        if (result.code) { setNotice(result.message); setBusy(false); return; }
        setNotice('Invite sent'); setDialog({ type: 'create' }); setBusy(false); return;
      }
      setDialog(null);
    } catch (error) { setNotice(error.message || 'Something went wrong.'); }
    setBusy(false);
  };
  if (comingSoon) return <div className="doctor-dashboard"><main className="doctor-coming-soon"><Activity size={30}/><h1>Coming soon</h1><p>This section is being prepared.</p><NavLink to="/doctor/appointments">Back to appointments</NavLink></main></div>;
  return <div className="doctor-dashboard"><DoctorSidebar user={effectiveUser} onLogout={() => logoutUser().then(() => navigate('/login')).catch(() => showToast('Could not sign out. Please try again.'))} /><main className="doctor-workspace"><header className="doctor-topbar"><div className="doctor-appointments-title"><p>{salutation}, Dr. {doctorName}!</p><h1>Appointments</h1></div><div className="doctor-top-actions"><button aria-label="Messages" type="button" onClick={() => navigate('/doctor/messages')}><MessageCircle/></button><div className="doctor-profile"><span className="doctor-avatar">{effectiveUser.full_name?.charAt(0) || 'D'}</span><span><strong>{effectiveUser.full_name}</strong><small>{effectiveUser.doctor_profile?.speciality || 'Cardiologist'}</small></span></div></div></header>
    <div className="doctor-appointments-content"><div className="doctor-appointments-toolbar"><div className="doctor-appointment-tabs" role="tablist" aria-label="Appointment lists">{tabs.map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}<span>{counts[key]}</span></button>)}</div><div className="doctor-appointment-controls"><label className="doctor-appointment-search"><Search size={16}/><input aria-label="Search appointments" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)}/></label><select aria-label="Patient and quick action filter" value={filter} onChange={(event) => setFilter(event.target.value)}>{filters.map((option) => <option key={option}>{option}</option>)}</select><button className="doctor-add-appointment" onClick={() => { setForm({ reason: '', note: '', patientQuery: '', phone: '', patientName: '', mode: 'IN_PERSON', date: todayDate(), slot: '', declineReason: '' }); setFormPatient(null); setDialog({ type: 'create' }); }}><Plus size={17}/> Add Appointment</button></div></div>
    <div className="doctor-appointment-list" aria-live="polite">{state === 'loading' ? Array.from({ length: 4 }, (_, i) => <div className="appointment-skeleton" key={i}><i/><span/><span/><span/></div>) : state === 'error' ? <div className="appointment-empty"><p>We couldn’t load appointments.</p><button onClick={load}>Try again</button></div> : !items.length ? <div className="appointment-empty"><p>{tab === 'today' ? 'No appointments today' : tab === 'upcoming' ? 'No upcoming appointments' : 'No pending requests'}</p></div> : items.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} tab={tab} now={clock} expanded={expanded[appointment.id]} onExpand={() => setExpanded((prev) => ({ ...prev, [appointment.id]: !prev[appointment.id] }))} onAction={(action) => handleAction(action, appointment)} pendingAccess={pendingAccess[appointment.id]} menuOpen={menuId === appointment.id} toggleMenu={() => setMenuId(menuId === appointment.id ? '' : appointment.id)} />)}</div>
    </div></main>
    {dialog?.type === 'complete' && <ConfirmDialog title="Complete appointment?" message="Complete without writing a consultation record? The patient will see no diagnosis or prescription for this visit." confirmText="Mark completed" onCancel={() => setDialog(null)} onConfirm={confirmDialog} busy={busy} />}
    {dialog?.type === 'no-show' && <ConfirmDialog title="Mark as no-show?" message={`Mark ${dialog.appointment.patient.name} as a no-show?`} confirmText="Mark No-Show" onCancel={() => setDialog(null)} onConfirm={confirmDialog} busy={busy} />}
    {dialog?.type === 'access' && <ConfirmDialog title="Request medical record access" message={`Ask ${dialog.appointment.patient.name} for one-time access to their records for this visit? Access will be valid for one hour after approval.`} confirmText="Request access" onCancel={() => setDialog(null)} onConfirm={confirmDialog} busy={busy} />}
    {dialog?.type === 'alert' && <Modal title="Send missed visit alert?" onClose={() => setDialog(null)}><div className="appointment-modal-form"><p>Send a message asking {dialog.appointment.patient.name} to reschedule?</p><div className="appointment-message-preview">Hi {dialog.appointment.patient.name.split(' ')[0]}, we missed you at your appointment. Please contact us to choose a new time.</div><footer><button className="patient-button secondary" onClick={() => setDialog(null)}>Cancel</button><button className="patient-button" disabled={busy} onClick={confirmDialog}>{busy ? 'Sending…' : 'Send alert'}</button></footer></div></Modal>}
    {dialog?.type === 'decline' && <Modal title="Decline appointment request" onClose={() => setDialog(null)}><div className="appointment-modal-form"><p>Let {dialog.appointment.patient.name} know why you cannot accept this request.</p><div className="appointment-quick-reasons">{['Not available', 'Outside my specialty', 'Fully booked'].map((reason) => <button type="button" key={reason} onClick={() => setForm((current) => ({ ...current, declineReason: reason }))}>{reason}</button>)}</div><Textarea required minLength={5} value={form.declineReason} onChange={(event) => setForm((current) => ({ ...current, declineReason: event.target.value }))} placeholder="Reason (at least 5 characters)"/><footer><button className="patient-button secondary" onClick={() => setDialog(null)}>Cancel</button><button className="patient-button danger" disabled={busy || form.declineReason.trim().length < 5} onClick={confirmDialog}>{busy ? 'Declining…' : 'Decline request'}</button></footer></div></Modal>}
    {dialog?.type === 'propose' && <Modal title="Propose a new time" onClose={() => setDialog(null)}><div className="appointment-modal-form"><label>Choose a date<DatePicker value={form.date} min={todayDate()} onChange={async (date) => { setForm((current) => ({ ...current, date, slot: '' })); setSlots(await getDoctorSlots(date)); }}/></label><label>Available times<SlotChips slots={slots} value={form.slot} onChange={(slot) => setForm((current) => ({ ...current, slot }))}/></label><label>Optional note<Textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Add a note for the patient"/></label><footer><button className="patient-button secondary" onClick={() => setDialog(null)}>Cancel</button><button className="patient-button" disabled={busy || !form.slot} onClick={confirmDialog}>{busy ? 'Saving…' : 'Propose new time'}</button></footer></div></Modal>}
    {(dialog?.type === 'create' || dialog?.type === 'invite') && <Modal title={dialog.type === 'create' ? 'Add Appointment' : 'Invite patient'} onClose={() => setDialog(null)}><div className="appointment-modal-form"><label>Find a treated patient<Autocomplete value={form.patientQuery} onChange={(patientQuery) => { setFormPatient(null); setForm((current) => ({ ...current, patientQuery })); }} search={searchMyPatients} onSelect={(patient) => { setFormPatient(patient); setForm((current) => ({ ...current, patientQuery: patient.name })); }}/></label>{!formPatient && <><p className="appointment-form-hint">Search is limited to patients you have treated. Invite a new patient by phone.</p><label>Patient name<input className="appointment-modal-field" value={form.patientName} onChange={(event) => setForm((current) => ({ ...current, patientName: event.target.value }))}/></label><label>Phone number<input className="appointment-modal-field" type="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}/></label>{dialog.type === 'invite' || (form.phone && <button className="patient-button secondary" disabled={busy || !form.phone || !form.patientName} onClick={() => setDialog({ type: 'invite' })}>Invite patient</button>)}</>}{formPatient && <><label>Reason for visit<Textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}/></label><label>Visit mode<select className="appointment-modal-field" value={form.mode} onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value }))}><option value="IN_PERSON">In-Person</option><option value="VIDEO">Video Call</option></select></label><label>Date<DatePicker value={form.date} min={todayDate()} onChange={async (date) => { setForm((current) => ({ ...current, date, slot: '' })); setSlots(await getDoctorSlots(date)); }}/></label><label>Available times<SlotChips slots={slots} value={form.slot} onChange={(slot) => setForm((current) => ({ ...current, slot }))}/></label></>}<footer><button className="patient-button secondary" onClick={() => setDialog(null)}>Cancel</button>{dialog.type === 'invite' ? <button className="patient-button" disabled={busy || !form.phone || !form.patientName} onClick={confirmDialog}>{busy ? 'Sending…' : 'Send invite'}</button> : formPatient && <button className="patient-button" disabled={busy || !form.slot || !form.reason.trim()} onClick={confirmDialog}>{busy ? 'Saving…' : 'Create appointment'}</button>}</footer></div></Modal>}
    {toast && <div className="doctor-appointment-toast" role="status">{toast.message}{toast.action && <button className="doctor-toast-action" onClick={() => toast.action()}>Undo</button>}</div>}
    {summaryAppointment && (
      <AiClinicalSummaryModal
        appointment={summaryAppointment}
        onClose={() => setSummaryAppointment(null)}
      />
    )}
  </div>;
}

export function AppointmentCard({ appointment: a, tab, now, expanded, onExpand, onAction, pendingAccess, menuOpen, toggleMenu }) {
  const access = hasRecordAccess(a, now);
  const terminal = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status);
  const showNotes = access || ['IN_CONSULTATION', 'COMPLETED'].includes(a.status);
  const summaryHeading = tab === 'today' ? 'Chief Complaint & Diagnosis Notes' : 'Reason for visit';
  const action = (label, kind = '', Icon, key = label) => <button type="button" disabled={label.startsWith('Alert sent')} className={`appointment-action ${kind}`} onClick={() => onAction(key)}>{Icon && <Icon size={15}/>}<span>{label}</span></button>;
  const StatusIcon = a.status === 'WAITING' ? Clock3 : a.status === 'COMPLETED' ? CheckCircle2 : a.status === 'REQUESTED' ? ClipboardList : Check;
  const ModeIcon = a.mode === 'VIDEO' ? Video : UserRound;
  return <article className={`doctor-appointment-card ${a.status === 'MISSED' ? 'missed-card' : ''}`}>
    <div className="appointment-identity"><div className="appointment-person">{a.patient.photoUrl ? <img src={a.patient.photoUrl} alt=""/> : <span className="appointment-avatar">{a.patient.name.split(' ').map((x) => x[0]).slice(0,2).join('')}</span>}<div><h2>{a.patient.name} <span>({a.patient.age}, {a.patient.gender}) · Token #{String(a.tokenNumber).padStart(2,'0')}</span></h2><div className="appointment-badges"><span className={`appointment-badge mode-${a.mode.toLowerCase()}`}><ModeIcon size={13}/>{a.mode === 'VIDEO' ? 'Video Call' : 'In-Person'}</span><span className={`appointment-badge state-${a.status.toLowerCase()}`}><StatusIcon size={13}/>{statusLabels[a.status]}{a.status === 'WAITING' && <span aria-live="polite"> ({waitingMinutes(a, now)} min)</span>}</span></div></div></div><div className="appointment-vitals">{a.checkInVitals ? `BP ${a.checkInVitals.bpSys}/${a.checkInVitals.bpDia} mmHg · SpO₂ ${a.checkInVitals.spo2}% · Pulse ${a.checkInVitals.pulse} bpm` : 'Vitals not recorded'}</div></div>
    <div className="appointment-summary"><h3>{summaryHeading}</h3><p className={expanded ? '' : 'clamped'}>{showNotes && a.doctorNotes ? `${a.reason} ${a.doctorNotes}` : a.reason}</p>{a.status === 'PROPOSED_NEW_TIME' && a.proposedSlot && <small>Proposed: {time(a.proposedSlot.startsAt)} · {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' }).format(new Date(a.proposedSlot.startsAt))}</small>}{a.reason.length > 120 && <button className="appointment-read-more" onClick={onExpand}>{expanded ? 'Read less' : 'Read more'}</button>}{tab === 'requests' && <small>Waiting {Math.max(0, Math.floor((now - new Date(a.createdAt)) / 60000))} minutes</small>}</div>
    <div className="appointment-utilities">{!terminal && <button onClick={() => onAction('chat')}><MessageCircle size={15}/> Chat</button>}{a.mode === 'VIDEO' && <button disabled={!isJoinWindowOpen(a, now)} title={!isJoinWindowOpen(a, now) ? 'Available 10 minutes before the visit' : ''} onClick={() => onAction('join-video')}><Video size={15}/> Join Video Call</button>}<button type="button" className={`btn-open-records ${access ? 'has-access' : ''}`} onClick={() => onAction('records')} title="View patient health records & clinical history"><FileText size={15}/> Open Medical Records</button><button type="button" style={{ color: '#0e695d', borderColor: '#a7dad3', fontWeight: 600, background: '#f0f9f8' }} onClick={() => onAction('ai-summary')} title="Analyze patient records & vitals with Gemini Clinical AI"><Sparkles size={14} style={{ color: '#107569' }} /> AI Summary</button>{!access && (pendingAccess || a.consent?.status === 'PENDING' ? <><small className="access-pending"><Clock size={12}/> Request sent, waiting for patient</small>{import.meta.env.DEV && <button className="request-access" onClick={() => onAction('simulate-consent')}>Simulate patient approval</button>}</> : <button className="request-access" onClick={() => onAction('request-access')}>Request access</button>)}{access && <small>Access until {time(a.consent.expiresAt)}</small>}</div>
    <div className="appointment-actions"><button type="button" className="btn-ai-summary" onClick={() => onAction('ai-summary')} title="Generate instant AI Clinical Summary from patient vitals and uploaded medical PDFs"><Sparkles size={14} className="sparkle-icon" /><span>✨ Generate AI Summary</span></button>{terminal ? <><span className={`final-status state-${a.status.toLowerCase()}`}>{statusLabels[a.status]}</span><button className="appointment-summary-link" onClick={() => onAction('view-summary')}>View summary</button></> : a.status === 'MISSED' ? <>{action(a.missedAlertSentAt ? `Alert sent ${time(a.missedAlertSentAt)}` : 'Send Missed Visit Alert', a.missedAlertSentAt ? 'coral sent' : 'coral', a.missedAlertSentAt ? Check : undefined, 'missed-alert')}{action('Mark No-Show','outline',undefined,'no-show')}{a.missedAlertSentAt && <button className="appointment-summary-link" onClick={() => onAction('offer-time')}>Offer a new time</button>}</> : a.status === 'REQUESTED' ? <>{action('Accept','primary',undefined,'accept')}{action('Decline','outline',undefined,'decline')}{action('Propose new time','text',undefined,'propose')}</> : <>{(canTransition(a.status, 'IN_CONSULTATION') || a.status === 'IN_CONSULTATION') && action('Complete Consultation','primary',Stethoscope,'complete-consultation')}{canTransition(a.status, 'COMPLETED') && action('Mark as Completed','success-outline',undefined,'mark-completed')}{canTransition(a.status, 'NO_SHOW') && action('Mark No-Show','outline',undefined,'no-show')}</>}</div>
    {menuOpen && <div className="appointment-more-menu">{canTransition(a.status, 'COMPLETED') && action('Mark as Completed','success-outline',undefined,'mark-completed')}{canTransition(a.status, 'NO_SHOW') && action('Mark No-Show','outline',undefined,'no-show')}</div>}<button className="appointment-more" aria-label="More appointment actions" onClick={toggleMenu}><MoreHorizontal size={19}/></button>
  </article>;
}

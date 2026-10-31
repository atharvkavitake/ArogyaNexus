import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, IndianRupee, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import PatientLayout from '../../components/patient/PatientLayout';
import { Avatar, Button, Card, EmptyState, SlotChips, StatusChip, Stepper } from '../../components/ui';
import { useActiveProfile } from '../../contexts/activeProfile';
import { createAppointmentRequest, getDoctorAvailability, getDoctorById } from '../../api/doctors';
import '../../styles/patient-doctors.css';

const steps = ['Choose date', 'Choose time', 'Visit details', 'Consent & confirm'];

export default function BookAppointment() {
  const { doctorId } = useParams();
  const { activeProfile } = useActiveProfile();
  const [resource, setResource] = useState({ key: '', status: 'loading', doctor: null, days: [] });
  const [reload, setReload] = useState(0);
  const [step, setStep] = useState(1);
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const [reason, setReason] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [appointment, setAppointment] = useState(null);
  const key = `${doctorId}:${activeProfile.id}:${reload}`;
  const retry = useCallback(() => setReload((value) => value + 1), []);
  useEffect(() => {
    let current = true;
    Promise.all([getDoctorById(doctorId, activeProfile.id), getDoctorAvailability(doctorId, activeProfile.id)])
      .then(([doctor, days]) => { if (current) setResource({ key, status: 'ready', doctor, days }); })
      .catch(() => { if (current) setResource({ key, status: 'error', doctor: null, days: [] }); });
    return () => { current = false; };
  }, [doctorId, activeProfile.id, key]);
  const loading = resource.key !== key;
  const state = loading ? 'loading' : resource.status === 'error' ? 'error' : undefined;
  const doctor = state ? null : resource.doctor;
  const days = state ? [] : resource.days;
  const selectedDay = days.find((day) => day.date === date) || null;
  const goNext = () => {
    if (step === 1 && !date) return;
    if (step === 2 && !slot) return;
    if (step < 4) setStep((value) => value + 1);
  };

  const submit = async () => {
    if (!doctor || !consent || !selectedDay || !slot) return;
    setSubmitting(true);
    setSubmitError('');
    const appointmentAt = new Date(`${date}T${to24Hour(slot)}:00`);
    try {
      const result = await createAppointmentRequest({
        patient_id: activeProfile.id,
        doctor_profile_id: doctor.id,
        appointment_at: appointmentAt.toISOString(),
        reason: reason.trim() || null,
      });
      setAppointment(result);
    } catch (error) {
      setSubmitError(error.message || 'The appointment request could not be sent.');
    } finally {
      setSubmitting(false);
    }
  };

  return <PatientLayout profile={activeProfile}><main className="patient-content patient-booking-page">
    <Link className="patient-back-link" to={doctor ? `/patient/doctors/${doctor.id}` : '/patient/doctors'}><ArrowLeft size={16} /> Back to doctor profile</Link>
    <header className="patient-page-heading"><div><p>PLAN YOUR VISIT</p><h2>Book an appointment</h2><span>Choose a time that works for you and {activeProfile.name}.</span></div></header>
    {state === 'error' ? <Card title="Appointment booking" state="error" onRetry={retry} /> : loading ? <Card title="Appointment booking" state="loading" /> : !doctor || !days.length ? <Card className="doctor-booking-empty"><EmptyState text={!doctor ? 'This doctor profile is no longer available.' : 'No appointment times are currently available.'} /><Link to="/patient/doctors">Browse verified doctors</Link></Card> : appointment ? <AppointmentSuccess appointment={appointment} doctor={doctor} date={date} slot={slot} profile={activeProfile} /> : <>
      <Stepper steps={steps} currentStep={step} />
      <div className="patient-booking-grid"><section className="patient-booking-form-column"><Card className="booking-step-card" title={`${step}. ${steps[step - 1]}`}>
        {step === 1 && <fieldset className="booking-date-fieldset"><legend>Choose a day</legend><div className="booking-date-options">{days.map((day) => <button type="button" key={day.date} className={date === day.date ? 'selected' : ''} aria-pressed={date === day.date} onClick={() => { setDate(day.date); setSlot(''); }}><CalendarDays size={17} /><span>{day.label}</span><small>{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', { year: 'numeric' })}</small></button>)}</div></fieldset>}
        {step === 2 && (selectedDay ? <SlotChips slots={selectedDay.slots} value={slot} onChange={setSlot} label={`Available times · ${selectedDay.label}`} /> : <EmptyState text="Choose an appointment date first." />)}
        {step === 3 && <label className="booking-reason-field">What would you like the doctor to know? <span>(optional)</span><textarea value={reason} maxLength={500} rows={5} onChange={(event) => setReason(event.target.value)} placeholder="Briefly describe the reason for this visit" /><small>{reason.length}/500 characters</small></label>}
        {step === 4 && <div className="booking-review"><div className="booking-review-row"><CalendarDays size={17} /><span><small>Date</small><strong>{selectedDay?.label}, {new Date(`${date}T12:00:00`).getFullYear()}</strong></span></div><div className="booking-review-row"><Clock3 size={17} /><span><small>Time</small><strong>{slot}</strong></span></div><div className="booking-review-row"><IndianRupee size={17} /><span><small>Consultation fee</small><strong>₹{doctor.consultation_fee.toLocaleString('en-IN')}</strong></span></div><div className="booking-consent-notice"><ShieldCheck size={19} /><p><strong>Your health information stays in your control.</strong> The clinic will only receive the details needed for this appointment. You can review or change provider access later in Consent &amp; Access.</p></div><label className="booking-consent-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree to share relevant health information with {doctor.user.full_name} for this appointment request.</span></label>{submitError && <p className="booking-submit-error" role="alert">{submitError}</p>}</div>}
        <div className="booking-step-actions">{step > 1 && <Button type="button" variant="secondary" onClick={() => setStep((value) => value - 1)}>Back</Button>}{step < 4 ? <Button type="button" disabled={(step === 1 && !date) || (step === 2 && !slot)} onClick={goNext}>Continue <ArrowRight size={15} /></Button> : <Button type="button" disabled={!consent || submitting} onClick={submit}>{submitting ? 'Sending request…' : submitError ? 'Try again' : 'Confirm appointment'} <ArrowRight size={15} /></Button>}</div>
      </Card></section><aside className="patient-booking-summary"><Card className="booking-doctor-card" title="Your appointment"><div className="booking-doctor-summary"><Avatar name={doctor.user.full_name} initials={doctor.user.full_name.split(' ').map((part) => part[0]).join('').replaceAll('.', '')} size="lg" /><div><StatusChip status="Verified" /><h3>{doctor.user.full_name}</h3><span>{doctor.speciality}</span></div></div><div className="booking-summary-details"><span><CalendarDays size={15} /> {selectedDay?.label || 'Select a date'}</span><span><Clock3 size={15} /> {slot || 'Select a time'}</span><span><IndianRupee size={15} /> ₹{doctor.consultation_fee.toLocaleString('en-IN')}</span></div><p className="booking-summary-clinic">{doctor.clinic_name}<small>{doctor.clinic_address}</small></p></Card><Card className="booking-profile-card" title="Booking for"><div className="booking-profile-identity"><Avatar name={activeProfile.name} initials={activeProfile.initials} size="sm" /><span><strong>{activeProfile.name}</strong><small>{activeProfile.relation || activeProfile.label} · Selected profile</small></span></div></Card></aside></div>
    </>}
  </main></PatientLayout>;
}

function to24Hour(label) {
  const [time, modifier] = label.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function AppointmentSuccess({ appointment, doctor, date, slot, profile }) {
  return (
    <Card className="booking-success-card">
      <span className="booking-success-icon"><CheckCircle2 size={27} /></span>
      <p className="patient-kicker">REQUEST RECEIVED</p>
      <h2>Appointment request sent</h2>
      <p>Your request for {profile.name} has been sent to {doctor.user.full_name}. The clinic will confirm your appointment.</p>
      <div className="booking-success-summary">
        <span><CalendarDays size={16} /> {new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</span>
        <span><Clock3 size={16} /> {slot}</span>
        <StatusChip status={appointment.status} />
      </div>
      <div className="booking-success-actions" style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link className="patient-button primary" to="/patient/appointments">View All Appointments</Link>
        <Link className="patient-button secondary" to="/patient/dashboard">Return to dashboard</Link>
      </div>
    </Card>
  );
}

import { useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { updatePatientProfile } from '../../api/patients';
import { useActiveProfile } from '../../contexts/activeProfile';
import { Button } from '../../components/ui';
import '../../styles/patient-onboarding.css';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function PatientOnboarding() {
  const { activeProfile, refreshProfiles } = useActiveProfile();
  const navigate = useNavigate();
  const [step, setStep] = useState(Math.min(3, Math.max(1, activeProfile?.onboardingStep || 1)));
  const [draft, setDraft] = useState(() => ({
    dateOfBirth: activeProfile?.dateOfBirth ? new Date(activeProfile.dateOfBirth).toISOString().slice(0, 10) : '',
    sex: activeProfile?.sex || '',
    bloodGroup: activeProfile?.bloodGroup || '',
    allergies: (activeProfile?.allergies || []).join(', '),
    conditions: (activeProfile?.conditions || []).join(', '),
  }));
  const [allergiesConfirmed, setAllergiesConfirmed] = useState(Boolean(activeProfile?.allergiesConfirmed));
  const [conditionsConfirmed, setConditionsConfirmed] = useState(Boolean(activeProfile?.conditionsConfirmed));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const saveStep = async () => {
    setBusy(true);
    setError('');
    const currentStep = step;
    const nextStep = currentStep === 3 ? 3 : currentStep + 1;
    const patch = { onboardingStep: nextStep };
    if (currentStep === 1) {
      patch.dateOfBirth = draft.dateOfBirth || null;
      patch.sex = draft.sex || null;
      patch.bloodGroup = draft.bloodGroup || null;
    } else if (currentStep === 2) {
      if (!allergiesConfirmed) { setError('Confirm your allergy information, including if you have none.'); setBusy(false); return; }
      patch.allergies = draft.allergies.split(',').map((value) => value.trim()).filter(Boolean);
      patch.allergiesConfirmed = true;
    } else {
      if (!conditionsConfirmed) { setError('Confirm your condition information, including if you have none.'); setBusy(false); return; }
      patch.conditions = draft.conditions.split(',').map((value) => value.trim()).filter(Boolean);
      patch.conditionsConfirmed = true;
    }
    try {
      await updatePatientProfile(activeProfile.id, patch);
      await refreshProfiles();
      if (currentStep === 3) navigate('/patient/dashboard', { replace: true });
      else setStep(nextStep);
    } catch (failure) {
      setError(failure.message || 'Could not save your profile. Please try again.');
    } finally { setBusy(false); }
  };

  return <main className="patient-onboarding"><section className="onboarding-card"><p className="onboarding-eyebrow">WELCOME TO AROGYANEXUS</p><h1>Let’s set up your health profile</h1><p className="onboarding-intro">Add a few details so your care information is ready when you need it. You can update these later in Settings.</p>
    <ol className="onboarding-steps" aria-label="Onboarding progress">{['About you', 'Allergies', 'Conditions'].map((label, index) => <li className={step === index + 1 ? 'current' : step > index + 1 ? 'complete' : ''} key={label}><span>{step > index + 1 ? <CheckCircle2 size={17} /> : index + 1}</span>{label}</li>)}</ol>
    {step === 1 && <section className="onboarding-fields"><h2>About you</h2><label>Date of birth<input type="date" value={draft.dateOfBirth} onChange={(event) => setDraft({ ...draft, dateOfBirth: event.target.value })} /></label><label>Sex<select value={draft.sex} onChange={(event) => setDraft({ ...draft, sex: event.target.value })}><option value="">Choose an option</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Prefer not to say</option></select></label><label>Blood group<select value={draft.bloodGroup} onChange={(event) => setDraft({ ...draft, bloodGroup: event.target.value })}><option value="">Not provided</option>{bloodGroups.map((group) => <option key={group}>{group}</option>)}</select></label></section>}
    {step === 2 && <section className="onboarding-fields"><h2>Allergies</h2><p>List known allergies separated by commas. Leave blank if you have none.</p><label>Allergies<input value={draft.allergies} onChange={(event) => setDraft({ ...draft, allergies: event.target.value })} placeholder="For example, penicillin, pollen" /></label><label className="onboarding-confirm"><input type="checkbox" checked={allergiesConfirmed} onChange={(event) => setAllergiesConfirmed(event.target.checked)} /> I confirm this allergy information is complete.</label></section>}
    {step === 3 && <section className="onboarding-fields"><h2>Health conditions</h2><p>List any current or past conditions separated by commas. Leave blank if you have none.</p><label>Conditions<input value={draft.conditions} onChange={(event) => setDraft({ ...draft, conditions: event.target.value })} placeholder="For example, asthma, diabetes" /></label><label className="onboarding-confirm"><input type="checkbox" checked={conditionsConfirmed} onChange={(event) => setConditionsConfirmed(event.target.checked)} /> I confirm this condition information is complete.</label></section>}
    {error && <p className="onboarding-error" role="alert">{error}</p>}
    <footer className="onboarding-actions">{step > 1 && <Button type="button" variant="secondary" disabled={busy} onClick={() => setStep(step - 1)}><ChevronLeft size={16} /> Back</Button>}<Button type="button" disabled={busy} onClick={saveStep}>{busy ? 'Saving…' : step === 3 ? 'Finish setup' : 'Save and continue'}{step < 3 && <ChevronRight size={16} />}</Button></footer>
  </section></main>;
}

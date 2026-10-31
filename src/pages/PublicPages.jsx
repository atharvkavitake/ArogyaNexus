import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity, ArrowRight, BadgeCheck, Baby, Bone, Brain, CalendarDays, Check,
  ChevronDown, Clock3, HeartPulse, MapPin, Menu, Search, ShieldCheck, Smile,
  Sparkles, Stethoscope, UserRound, Users, Venus, X,
} from 'lucide-react';
import { getCurrentUser, getRedirectPathForUser, logoutUser } from '../services/auth/authService';
import '../styles/public.css';

const CITIES = ['Kolhapur', 'Sangli', 'Satara', 'Pune', 'Mumbai', 'Nashik', 'Solapur', 'Bengaluru'];
const SPECIALITIES = [
  { name: 'Cardiology', Icon: HeartPulse }, { name: 'Orthopedic', Icon: Bone },
  { name: 'Dermatology', Icon: Sparkles }, { name: 'Neurology', Icon: Brain },
  { name: 'Pediatrics', Icon: Baby }, { name: 'Gynecology', Icon: Venus },
  { name: 'General Physician', Icon: Stethoscope }, { name: 'Dentist', Icon: Smile },
];

function PublicLayout({ children }) {
  const [user, setUser] = useState(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    getCurrentUser().then((currentUser) => {
      if (active) {
        setUser(currentUser);
        setUserLoaded(true);
      }
    });
    return () => { active = false; };
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    navigate('/', { replace: true });
  };

  return (
    <div className="public-site">
      <header className="public-header">
        <div className="public-header-inner">
          <Link className="public-brand" to="/" aria-label="ArogyaNexus home"><span><Activity size={23} /></span><b>AROGYA<span>NEXUS</span></b></Link>
          <button className="public-menu-toggle" type="button" aria-label="Toggle navigation" onClick={() => setMobileMenu((open) => !open)}>{mobileMenu ? <X /> : <Menu />}</button>
          <nav className={`public-nav${mobileMenu ? ' open' : ''}`}>
            <Link to="/doctors" onClick={() => setMobileMenu(false)}>Find Doctors</Link>
            <Link to="/#specialities" onClick={() => setMobileMenu(false)}>Specialities</Link>
            <Link to="/#about" onClick={() => setMobileMenu(false)}>About Us</Link>
          </nav>
          <div className="public-account-links">
            {userLoaded && user ? <><Link className="public-dashboard-link" to={getRedirectPathForUser(user)}>Dashboard</Link><button type="button" onClick={handleLogout}>Logout</button></> : <><Link className="public-login-link" to="/login">Login</Link><Link className="public-register-link" to="/register">Register</Link></>}
          </div>
        </div>
      </header>
      {children({ user, userLoaded })}
      <footer className="public-footer"><div className="public-footer-inner"><Link className="public-brand" to="/"><span><Activity size={21} /></span><b>AROGYA<span>NEXUS</span></b></Link><p>Care that connects you to better health.</p><small>© {new Date().getFullYear()} ArogyaNexus. If you have a medical emergency, contact your local emergency services.</small></div></footer>
    </div>
  );
}

function DoctorCard({ doctor, onBook }) {
  return (
    <article className="public-doctor-card">
      <div className="public-doctor-card-top"><span className="public-doctor-avatar"><UserRound size={23} /></span><div className="public-doctor-name"><h3>{doctor.name}</h3><p>{doctor.speciality}{doctor.qualification ? ` · ${doctor.qualification}` : ''}{doctor.experienceYears ? ` · ${doctor.experienceYears}+ yrs` : ''}</p></div><span className="public-rating">{doctor.rating ? <>★ {doctor.rating.toFixed(1)}<small>{doctor.reviewCount}+ reviews</small></> : <>New<small>No reviews yet</small></>}</span></div>
      <div className="public-clinic"><b>Clinic: {doctor.clinic}</b><span>{doctor.city || doctor.clinicAddress}</span></div>
      <div className="public-fee"><span>Consultation fee</span><b>₹{Number(doctor.consultationFee).toLocaleString('en-IN')}</b></div>
      <div className="public-availability"><span className="availability-pending"><Clock3 size={13} /> Availability not published</span><span className="verified-tag"><BadgeCheck size={13} /> Verified doctor</span></div>
      <div className="public-card-actions"><Link to={`/doctors/${doctor.id}`}>View Profile</Link><button type="button" onClick={() => onBook(doctor)}>Book Slot</button></div>
    </article>
  );
}

function BookingDialog({ doctor, user, userLoaded, onClose }) {
  const [appointmentAt, setAppointmentAt] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const minDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const response = await fetch('/api/appointments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ doctorId: doctor.id, appointmentAt: new Date(appointmentAt).toISOString(), reason }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not request an appointment.');
      setSuccess(true);
    } catch (requestError) {
      setError(requestError.message || 'Could not request an appointment.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="public-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="public-booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title"><button className="public-modal-close" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
    {success ? <div className="public-booking-result"><span className="booking-result-icon"><Check size={25} /></span><h2 id="booking-title">Request sent</h2><p>Your appointment request for {doctor.name} has been submitted. The clinic will confirm the time with you.</p><button type="button" onClick={onClose}>Done</button></div> : !userLoaded ? <div className="public-booking-result"><h2 id="booking-title">Checking your sign in…</h2></div> : !user ? <div className="public-booking-result"><span className="booking-result-icon"><CalendarDays size={24} /></span><p className="public-dialog-eyebrow">{doctor.name}</p><h2 id="booking-title">Login Required</h2><p>Please login or create a patient account to book an appointment.</p><div className="public-modal-actions"><Link to="/login">Login</Link><Link to="/register">Register</Link></div></div> : user.role !== 'patient' ? <div className="public-booking-result"><span className="booking-result-icon"><ShieldCheck size={24} /></span><h2 id="booking-title">Patient account required</h2><p>Appointments can only be requested from a patient account. You’re signed in as a {user.role}.</p><Link className="public-modal-primary" to="/login">Switch account</Link></div> : <><p className="public-dialog-eyebrow">REQUEST AN APPOINTMENT</p><h2 id="booking-title">Book with {doctor.name}</h2><p className="public-booking-subtitle">Choose a time to request. The clinic will confirm availability.</p><form onSubmit={submit} className="public-booking-form"><label>Date and time<input type="datetime-local" min={minDate} value={appointmentAt} onChange={(event) => setAppointmentAt(event.target.value)} required /></label><label>Note for the clinic <span>(optional)</span><textarea maxLength={500} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Share a brief reason for your visit" /></label>{error && <p className="public-booking-error" role="alert">{error}</p>}<button type="submit" disabled={saving || !appointmentAt}>{saving ? 'Sending request…' : 'Request appointment'}</button></form></>}
  </section></div>;
}

function usePublicDoctors(params) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const queryString = params.toString();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetch(`/api/public/doctors${queryString ? `?${queryString}` : ''}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Could not load doctors.');
        if (active) setDoctors(data.doctors || []);
      })
      .catch((requestError) => { if (active) setError(requestError.message || 'Could not load doctors.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [queryString]);
  return { doctors, loading, error };
}

export function PublicHomePage() {
  const [city, setCity] = useState('');
  const [query, setQuery] = useState('');
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const navigate = useNavigate();
  const { doctors, loading } = usePublicDoctors(new URLSearchParams());
  const featuredDoctors = doctors.slice(0, 3);

  const searchDoctors = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (query.trim()) params.set('q', query.trim());
    navigate(`/doctors${params.size ? `?${params.toString()}` : ''}`);
  };

  return <PublicLayout>{({ user, userLoaded }) => {
    return <>
      <section className="public-hero"><div className="public-hero-inner"><div className="public-hero-copy"><span className="public-kicker"><ShieldCheck size={15} /> TRUSTED CARE, CLOSER TO YOU</span><h1>Healthcare Made <span>Simple</span></h1><p>Find the right doctor, book appointments, and manage your health seamlessly.</p><form className="public-search-form" onSubmit={searchDoctors}><label className="public-city-select"><MapPin size={18} /><select value={city} onChange={(event) => setCity(event.target.value)} aria-label="Select city"><option value="">Select City</option>{CITIES.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={15} /></label><label className="public-query-input"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search doctors, specialities, or hospitals..." aria-label="Search doctors, specialities, or hospitals" /></label><button type="submit">Find Doctors <ArrowRight size={16} /></button></form><div className="public-hero-trust"><span><Check size={14} /> Verified doctors</span><span><Check size={14} /> Secure appointments</span></div></div><div className="public-hero-visual" aria-hidden="true"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-medical-cross">+</div><div className="hero-doctor-main"><div className="hero-doctor-hair" /><div className="hero-doctor-face"><span /><i /></div><div className="hero-doctor-coat"><Stethoscope size={37} /></div></div><div className="hero-doctor-side side-one"><UserRound size={37} /></div><div className="hero-doctor-side side-two"><UserRound size={35} /></div><span className="hero-float-card"><BadgeCheck size={17} /> Trusted care</span><span className="hero-float-dot" /></div></div></section>
      <main className="public-home-content">
        <section className="public-section public-specialities" id="specialities"><div className="public-section-heading"><div><span className="public-section-kicker">CARE FOR EVERY NEED</span><h2>Explore specialities</h2></div><Link to="/doctors">All specialities <ArrowRight size={15} /></Link></div><div className="public-speciality-grid">{SPECIALITIES.map(({ name, Icon }) => <Link to={`/doctors?speciality=${encodeURIComponent(name)}`} className="public-speciality-card" key={name}><span><Icon size={25} /></span><b>{name}</b></Link>)}</div></section>
        <section className="public-section public-featured"><div className="public-section-heading"><div><span className="public-section-kicker">A GOOD PLACE TO START</span><h2>Verified doctors</h2><p>Browse approved professionals and find care that fits your needs.</p></div><Link to="/doctors">View all doctors <ArrowRight size={15} /></Link></div>{loading ? <div className="public-loading">Finding verified doctors…</div> : featuredDoctors.length ? <div className="public-doctor-grid">{featuredDoctors.map((doctor) => <DoctorCard key={doctor.id} doctor={doctor} onBook={setBookingDoctor} />)}</div> : <div className="public-empty-state"><Users size={24} /><b>Doctor profiles are being added</b><span>Check back soon or search the full directory.</span><Link to="/doctors">Browse doctors</Link></div>}</section>
        <section className="public-benefits" id="about"><div><span className="public-section-kicker">HEALTHCARE, CONNECTED</span><h2>Why ArogyaNexus?</h2><p>Thoughtful tools to help you connect with verified care and take the next step with confidence.</p></div><article><span><BadgeCheck /></span><div><b>Verified doctors</b><p>Every listed doctor is approved by our administrators.</p></div></article><article><span><ShieldCheck /></span><div><b>Privacy first</b><p>Your personal health details stay protected.</p></div></article><article><span><CalendarDays /></span><div><b>Easy appointment requests</b><p>Choose a time and let the clinic confirm your visit.</p></div></article></section>
      </main>
      {bookingDoctor && <BookingDialog doctor={bookingDoctor} user={user} userLoaded={userLoaded} onClose={() => setBookingDoctor(null)} />}
    </>;
  }}</PublicLayout>;
}

export function DoctorDiscoveryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const speciality = searchParams.get('speciality') || '';
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const params = new URLSearchParams();
  if (city) params.set('city', city);
  if (query.trim()) params.set('q', query.trim());
  if (speciality) params.set('speciality', speciality);
  const { doctors, loading, error } = usePublicDoctors(params);

  const submitSearch = (event) => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (city) next.set('city', city);
    if (query.trim()) next.set('q', query.trim());
    if (speciality) next.set('speciality', speciality);
    setSearchParams(next);
  };

  return <PublicLayout>{({ user, userLoaded }) => <>
    <section className="directory-hero"><div className="public-home-content"><span className="public-section-kicker">YOUR CARE, YOUR WAY</span><h1>Find a doctor you can trust</h1><p>Search verified healthcare professionals by name, speciality, clinic, or city.</p><form className="public-search-form directory-search-form" onSubmit={submitSearch}><label className="public-city-select"><MapPin size={18} /><select value={city} onChange={(event) => setCity(event.target.value)} aria-label="Filter by city"><option value="">All cities</option>{CITIES.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={15} /></label><label className="public-query-input"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Doctor, speciality, or clinic" aria-label="Search doctors" /></label><button type="submit">Search <ArrowRight size={16} /></button></form></div></section>
    <main className="public-home-content directory-content"><div className="directory-speciality-filter"><button className={!speciality ? 'selected' : ''} type="button" onClick={() => setSearchParams(city ? { city } : {})}>All specialities</button>{SPECIALITIES.map(({ name }) => <button key={name} className={speciality === name ? 'selected' : ''} type="button" onClick={() => { const next = new URLSearchParams(searchParams); if (speciality === name) next.delete('speciality'); else next.set('speciality', name); setSearchParams(next); }}>{name}</button>)}</div><div className="directory-heading"><div><span className="public-section-kicker">APPROVED HEALTHCARE PROFESSIONALS</span><h2>{speciality || 'Doctors'}{city ? ` in ${city}` : ''}</h2><p>{loading ? 'Searching…' : `${doctors.length} verified ${doctors.length === 1 ? 'doctor' : 'doctors'} found`}</p></div><label className="directory-sort">Sorted by<select defaultValue="verified"><option value="verified">Verified doctors</option><option value="fee">Consultation fee</option></select></label></div>{error ? <div className="public-empty-state"><b>Could not load doctors</b><span>{error}</span></div> : loading ? <div className="public-loading">Loading doctor directory…</div> : doctors.length ? <div className="public-doctor-grid">{doctors.map((doctor) => <DoctorCard key={doctor.id} doctor={doctor} onBook={setBookingDoctor} />)}</div> : <div className="public-empty-state"><Search size={24} /><b>No verified doctors found</b><span>Try another city or speciality.</span><button type="button" onClick={() => { setCity(''); setQuery(''); setSearchParams({}); }}>Clear filters</button></div>}</main>
    {bookingDoctor && <BookingDialog doctor={bookingDoctor} user={user} userLoaded={userLoaded} onClose={() => setBookingDoctor(null)} />}
  </>}</PublicLayout>;
}

export function PublicDoctorProfilePage() {
  const { doctorId } = useParams();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookingDoctor, setBookingDoctor] = useState(null);
  useEffect(() => {
    let active = true;
    fetch(`/api/public/doctors/${encodeURIComponent(doctorId)}`).then(async (response) => {
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Doctor profile not found.');
      if (active) setDoctor(data.doctor);
    }).catch((requestError) => { if (active) setError(requestError.message || 'Could not load profile.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [doctorId]);

  return <PublicLayout>{({ user, userLoaded }) => <main className="public-home-content profile-content">{loading ? <div className="public-loading">Loading doctor profile…</div> : error ? <div className="public-empty-state"><b>Doctor profile unavailable</b><span>{error}</span><Link to="/doctors">Back to doctor search</Link></div> : doctor && <><Link className="public-back-link" to="/doctors">← Back to doctors</Link><section className="public-profile-card"><div className="profile-cover" /><div className="profile-intro"><span className="profile-doctor-avatar"><UserRound size={38} /></span><div><span className="verified-tag"><BadgeCheck size={14} /> Verified doctor</span><h1>{doctor.name}</h1><p>{doctor.speciality}</p></div><div className="profile-rating">{doctor.rating ? `★ ${doctor.rating.toFixed(1)}` : 'New profile'}<small>{doctor.reviewCount ? `${doctor.reviewCount} public reviews` : 'No public reviews yet'}</small></div></div><div className="profile-columns"><div className="profile-details"><section><h2>About</h2><p>{doctor.qualification ? `${doctor.qualification}. ` : ''}{doctor.experienceYears ? `${doctor.experienceYears} years of experience.` : 'This verified professional is part of the ArogyaNexus care network.'}</p></section><section><h2>Clinic</h2><b>{doctor.clinic}</b><p>{doctor.clinicAddress}{doctor.city ? `, ${doctor.city}` : ''}</p></section><section><h2>Public reviews</h2><p>{doctor.reviewCount ? `Rated ${doctor.rating} by ${doctor.reviewCount} patients.` : 'No public reviews have been added yet.'}</p></section></div><aside className="profile-book-card"><span>CONSULTATION FEE</span><b>₹{Number(doctor.consultationFee).toLocaleString('en-IN')}</b><p><Clock3 size={15} /> {doctor.availability?.length ? 'Availability published' : 'Availability not published'}</p><button type="button" onClick={() => setBookingDoctor(doctor)}><CalendarDays size={16} /> Request Appointment</button><small>The clinic will confirm your requested time.</small></aside></div></section></>}{bookingDoctor && <BookingDialog doctor={bookingDoctor} user={user} userLoaded={userLoaded} onClose={() => setBookingDoctor(null)} />}</main>}</PublicLayout>;
}

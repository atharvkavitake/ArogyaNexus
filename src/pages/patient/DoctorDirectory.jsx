import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, MapPin, Search, SlidersHorizontal, Stethoscope, Video, Star, Navigation, Map as MapIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import PatientLayout from '../../components/patient/PatientLayout';
import { Avatar, Button, Card, EmptyState, StatusChip } from '../../components/ui';
import { useActiveProfile } from '../../contexts/activeProfile';
import { getDoctors } from '../../api/doctors';
import '../../styles/patient-doctors.css';
import '../../styles/patient-family-settings.css';

const specialities = [
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Paediatrics',
  'General Medicine',
  'Neurology',
  'Orthopaedics',
  'Ophthalmology',
  'ENT',
  'Psychiatry',
];
export default function DoctorDirectory() {
  const { activeProfile } = useActiveProfile();
  const [query, setQuery] = useState(''); const [location, setLocation] = useState(''); const [speciality, setSpeciality] = useState('');
  const [filters, setFilters] = useState({}); const [reload, setReload] = useState(0); const [showMap, setShowMap] = useState(false); const [locationError, setLocationError] = useState('');
  const [resource, setResource] = useState({ key: '', status: 'loading', doctors: [] });
  const key = `${activeProfile.id}:${JSON.stringify(filters)}:${reload}`;
  const retry = useCallback(() => setReload((value) => value + 1), []);
  useEffect(() => { let current = true; getDoctors(activeProfile.id, filters).then((doctors) => { if (current) setResource({ key, status: 'ready', doctors }); }).catch(() => { if (current) setResource({ key, status: 'error', doctors: [] }); }); return () => { current = false; }; }, [activeProfile.id, filters, key]);
  const loading = resource.key !== key; const state = loading ? 'loading' : resource.status === 'error' ? 'error' : undefined; const doctors = loading || state === 'error' ? [] : resource.doctors;
  const submit = (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setFilters({ query: query.trim(), location, speciality, distance: form.get('distance'), maxFee: form.get('maxFee'), minRating: form.get('minRating'), today: form.get('today') === 'on', video: form.get('video') === 'on', sort: form.get('sort') }); };
  const clearFilters = () => { setQuery(''); setLocation(''); setSpeciality(''); setFilters({}); };
  const useMyLocation = () => { setLocationError(''); if (!navigator.geolocation) { setLocationError('Location is unavailable in this browser.'); return; } navigator.geolocation.getCurrentPosition(({ coords }) => { const origin = { lat: coords.latitude, lng: coords.longitude }; try { window.localStorage.setItem('arogyanexus.location', JSON.stringify(origin)); } catch { /* Location remains available for this view. */ } setFilters((f) => ({ ...f, coordinates: [origin.lat, origin.lng] })); }, () => setLocationError('Location permission was not granted. Showing Bengaluru results.'), { timeout: 5000 }); };
  return <PatientLayout profile={activeProfile}><main className="patient-content patient-directory-page">
    <header className="patient-page-heading"><div><p>CARE THAT FITS YOUR NEEDS</p><h2>Find a doctor you can trust</h2><span>Browse verified specialists and care teams near you.</span></div></header>
    <form className="doctor-filter-card patient-card doctor-filter-expanded" onSubmit={submit} aria-label="Find doctors">
      <label className="doctor-search-field"><span>Search doctors or clinics</span><span className="doctor-search-input"><Search size={17}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Name, speciality, or clinic"/></span></label>
      <label><span>Speciality</span><select value={speciality} onChange={(e)=>setSpeciality(e.target.value)}><option value="">All specialities</option>{specialities.map((item)=><option key={item}>{item}</option>)}</select></label>
      <label><span>Location</span><span className="doctor-location-control"><select value={location} onChange={(e)=>setLocation(e.target.value)}><option value="">All locations</option><option value="bengaluru">Bengaluru</option><option value="pune">Pune</option><option value="mysuru">Mysuru</option></select><button type="button" title="Use my location" onClick={useMyLocation}><Navigation size={14}/></button></span></label>
      <label><span>Distance</span><select name="distance" defaultValue=""><option value="">Any distance</option><option value="5">Within 5 km</option><option value="10">Within 10 km</option><option value="25">Within 25 km</option></select></label>
      <label><span>Max fee</span><select name="maxFee" defaultValue=""><option value="">Any fee</option><option value="800">₹800</option><option value="1000">₹1,000</option><option value="1500">₹1,500</option></select></label>
      <label><span>Minimum rating</span><select name="minRating" defaultValue=""><option value="">Any rating</option><option value="4.5">4.5+</option><option value="4.8">4.8+</option></select></label>
      <label><span>Sort by</span><select name="sort" defaultValue="recommended"><option value="recommended">Recommended</option><option value="distance">Distance</option><option value="rating">Rating</option><option value="fee">Lowest fee</option></select></label>
      <div className="doctor-check-filters"><label><input type="checkbox" name="today"/> Available today</label><label><input type="checkbox" name="video"/> Video consultation</label></div><Button type="submit"><SlidersHorizontal size={15}/> Apply filters</Button>
    </form>{locationError && <p className="doctor-location-error" role="status">{locationError}</p>}
    <section className="doctor-directory-results"><div className="doctor-results-heading"><div><h3>Verified specialists</h3><p>{loading ? 'Finding doctors…' : `${doctors.length} ${doctors.length === 1 ? 'doctor' : 'doctors'} available`}</p></div><span><BadgeCheck size={15}/> Admin verified</span><button type="button" className="doctor-map-toggle" onClick={()=>setShowMap((v)=>!v)}><MapIcon size={14}/>{showMap?'Hide map':'Map view'}</button></div>
      {showMap && <div className="doctor-map-panel" aria-label="Map preview"><span className="map-label">Bengaluru care network</span>{doctors.map((doctor,index)=><span className={`map-pin pin-${index}`} key={doctor.id} title={`${doctor.user.full_name}, ${doctor.distance_km} km`}><MapPin size={16}/><b>{index+1}</b></span>)}<small>Map preview · distances calculated from your selected location</small></div>}
      {state==='error'?<Card state="error" onRetry={retry}/>:loading?<div className="doctor-results-grid"><Card title="Doctor profile" state="loading"/><Card title="Doctor profile" state="loading"/></div>:doctors.length?<div className="doctor-results-grid">{doctors.map((doctor)=><DoctorResultCard doctor={doctor} key={doctor.id}/>)}</div>:<Card className="doctor-empty-card"><EmptyState text="No verified doctors match these filters."/><Button variant="secondary" onClick={clearFilters}>Clear filters</Button></Card>}
    </section>
  </main></PatientLayout>;
}
function DoctorResultCard({ doctor }) { return <Card className="doctor-result-card"><div className="doctor-result-identity"><Avatar name={doctor.user.full_name} initials={doctor.user.full_name.split(' ').slice(1).map((part)=>part[0]).join('').replaceAll('.','')||'DR'} size="lg"/><div><StatusChip status="Verified" icon={BadgeCheck}/><h3>{doctor.user.full_name}</h3><p>{doctor.speciality}</p></div></div><div className="doctor-result-clinic"><strong>{doctor.clinic_name}</strong><span><MapPin size={14}/> {doctor.clinic_address}</span></div><div className="doctor-result-meta"><span><small>Consultation fee</small><strong>₹{doctor.consultation_fee.toLocaleString('en-IN')}</strong></span><span><small>Rating</small><strong><Star size={12} fill="currentColor"/> {doctor.rating} ({doctor.review_count})</strong></span><span><small>Distance</small><strong>{doctor.distance_km} km</strong></span></div><div className="doctor-result-badges">{doctor.today_available&&<span>Available today</span>}{doctor.video_available&&<span><Video size={12}/> Video visits</span>}</div><div className="doctor-result-actions"><Link to={`/patient/doctors/${doctor.id}`}>View profile <ArrowRight size={15}/></Link><Link className="patient-button primary" to={`/patient/book/${doctor.id}`}><Stethoscope size={15}/> Book appointment</Link></div></Card>; }

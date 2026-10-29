import { useState } from 'react';
import { Activity, Bell, CalendarDays, ChevronDown, ClipboardPlus, FileText, HeartPulse, Home, LockKeyhole, LogOut, Pill, Search, Settings, ShieldCheck, Users } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useActiveProfile } from '../../contexts/activeProfile';
import { Avatar } from '../ui';
import { logoutUser } from '../../services/auth/authService';
import '../../styles/patient-profile-context.css';

const links = [[Home, 'Home', '/patient/dashboard'], [Search, 'Find Doctors', '/patient/doctors'], [CalendarDays, 'Appointments', '/patient/appointments'], [ClipboardPlus, 'Health Records', '/patient/records'], [Pill, 'Medicines', '/patient/medicines'], [FileText, 'Documents', '/patient/documents'], [ShieldCheck, 'Consent & Access', '/patient/consent'], [HeartPulse, 'Camps', '/patient/camps'], [Users, 'Family', '/patient/family'], [Settings, 'Settings', '/patient/settings']];

function ProfileSwitcher() {
  const { profiles, activeProfile, setActiveProfile } = useActiveProfile();
  if (!activeProfile) return null;
  return <label className="profile-switcher"><Avatar name={activeProfile.name} initials={activeProfile.initials || activeProfile.name.split(' ').map((part) => part[0]).join('')} size="sm" /><span><strong>{activeProfile.name}</strong><small>{activeProfile.relation === 'SELF' ? 'Me' : activeProfile.relation}</small></span><ChevronDown size={15} /><select aria-label="Switch health profile" value={activeProfile.id} onChange={(event) => setActiveProfile(event.target.value)}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select></label>;
}

export default function PatientLayout({ children, profile }) {
  const navigate = useNavigate();
  const { activeProfile } = useActiveProfile();
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try { await logoutUser(); } catch { /* Keep the signed-in page usable when the local API is unavailable. */ }
    navigate('/login', { replace: true });
  };

  return <div className="patient-layout">
    <aside className="patient-sidebar"><a className="patient-brand" href="/patient/dashboard"><span><Activity size={23} /></span><b>Arogya<span>Nexus</span></b></a><nav className="patient-nav" aria-label="Patient navigation">{links.map(([Icon, label, to], index) => <NavLink end={index === 0} key={label} to={to} className={({ isActive }) => `patient-nav-link${isActive ? ' active' : ''}`}><Icon size={18} /><span>{label}</span></NavLink>)}</nav><div className="profile-completion"><span>Profile Completion</span><strong>{profile?.completion ?? activeProfile?.completeness ?? 0}%</strong><i style={{ '--completion': `${profile?.completion ?? activeProfile?.completeness ?? 0}%` }} /></div><button className="patient-logout-button" type="button" onClick={signOut} disabled={signingOut}><LogOut size={17} /><span>{signingOut ? 'Signing out…' : 'Log out'}</span></button></aside>
    <main className="patient-workspace"><header className="patient-topbar"><div className="patient-greeting"><h1>Good afternoon, <strong>{profile?.name || activeProfile?.name || 'Patient'}</strong></h1></div><label className="patient-search"><Search size={18} /><input aria-label="Search doctors, records, or medicines" placeholder="Search doctors, records, or medicines…" /></label><div className="patient-top-actions"><button type="button" className="notification-button" aria-label="Notifications, 2 unread"><Bell size={20} /><i>2</i></button><ProfileSwitcher /></div></header><div className="patient-mobile-profile"><ProfileSwitcher /></div>
      {activeProfile && activeProfile.relation !== 'SELF' && <div className={`active-profile-banner ${activeProfile.color}`}><Users size={16} /><span>Viewing <strong>{activeProfile.name}’s</strong> profile <small>· Only you can manage this profile</small></span></div>}
      {children}
      <nav className="patient-bottom-nav" aria-label="Mobile navigation">{[[Home, 'Home', '/patient/dashboard'], [Search, 'Doctors', '/patient/doctors'], [FileText, 'Records', '/patient/records'], [LockKeyhole, 'Consent', '/patient/consent'], [Users, 'Profile', '/patient/settings']].map(([Icon, label, href], index) => <NavLink to={href} end={index === 0} className={({ isActive }) => isActive ? 'active' : ''} key={label}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
    </main>
  </div>;
}

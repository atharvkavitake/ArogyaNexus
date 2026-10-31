import { useState } from 'react';
import { Activity, Bell, CalendarDays, ChevronDown, ClipboardPlus, FileText, HeartPulse, Home, LogOut, MessageCircle, Search, Settings, Users } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useActiveProfile } from '../../contexts/activeProfile';
import { Avatar } from '../ui';
import { logoutUser } from '../../services/auth/authService';

const links = [
  [Home, 'Home', '/patient/dashboard'],
  [Search, 'Find Doctors', '/patient/doctors'],
  [CalendarDays, 'Appointments', '/patient/appointments'],
  [MessageCircle, 'Messages', '/patient/messages'],
  [ClipboardPlus, 'Health Records', '/patient/records'],
  [HeartPulse, 'Camps', '/patient/camps'],
  [Users, 'Family', '/patient/family'],
  [Settings, 'Settings', '/patient/settings']
];

function ProfileSwitcher() {
  const { profiles, activeProfile, setActiveProfile } = useActiveProfile();
  return (
    <label className="profile-switcher">
      <Avatar name={activeProfile.name} initials={activeProfile.initials || activeProfile.name.split(' ').map((part) => part[0]).join('')} size="sm" />
      <span>
        <strong>{activeProfile.name}</strong>
        <small>{activeProfile.relation || activeProfile.label}</small>
      </span>
      <ChevronDown size={15} />
      <select aria-label="Switch health profile" value={activeProfile.id} onChange={(event) => setActiveProfile(event.target.value)}>
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>{profile.label}</option>
        ))}
      </select>
    </label>
  );
}

export default function PatientLayout({ children, profile }) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try { await logoutUser(); } catch { /* The local demo route can sign out without an API server. */ }
    navigate('/login', { replace: true });
  };
  return (
    <div className="patient-layout">
      <aside className="patient-sidebar">
        <a className="patient-brand" href="/patient/dashboard">
          <span><Activity size={23} /></span>
          <b>Arogya<span>Nexus</span></b>
        </a>
        <nav className="patient-nav" aria-label="Patient navigation">
          {links.map(([Icon, label, to], index) => (
            <NavLink end={index === 0} key={label} to={to} className={({ isActive }) => `patient-nav-link${isActive ? ' active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="patient-logout-button" type="button" onClick={signOut} disabled={signingOut}>
          <LogOut size={17} />
          <span>{signingOut ? 'Signing out…' : 'Log out'}</span>
        </button>
      </aside>
      <main className="patient-workspace">
        <header className="patient-topbar">
          <div className="patient-greeting">
            <h1>Good afternoon, <strong>{profile?.name || 'Rahul K.'}</strong></h1>
          </div>
          <label className="patient-search">
            <Search size={18} />
            <input aria-label="Search doctors, records, or medicines" placeholder="Search doctors, records, or medicines…" />
          </label>
          <div className="patient-top-actions">
            <button type="button" className="notification-button" aria-label="Notifications, 2 unread">
              <Bell size={20} />
              <i>2</i>
            </button>
            <ProfileSwitcher />
          </div>
        </header>
        <div className="patient-mobile-profile">
          <ProfileSwitcher />
        </div>
        {children}
        <nav className="patient-bottom-nav" aria-label="Mobile navigation">
          {[
            [Home, 'Home', '/patient/dashboard'],
            [CalendarDays, 'Appointments', '/patient/appointments'],
            [MessageCircle, 'Chat', '/patient/messages'],
            [ClipboardPlus, 'Records', '/patient/records'],
            [Users, 'Profile', '/patient/settings']
          ].map(([Icon, label, href], index) => (
            <NavLink to={href} end={index === 0} className={({ isActive }) => (isActive ? 'active' : '')} key={label}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </main>
    </div>
  );
}

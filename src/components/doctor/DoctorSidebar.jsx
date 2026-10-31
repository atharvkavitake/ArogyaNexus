import { Activity, CalendarDays, LayoutDashboard, LogOut, MessageCircle, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const links = [
  [LayoutDashboard, 'Dashboard', '/doctor/dashboard'],
  [CalendarDays, 'Appointments', '/doctor/appointments'],
  [MessageCircle, 'Messages', '/doctor/messages'],
  [Settings, 'Settings', '/doctor/settings'],
];

export default function DoctorSidebar({ user, onLogout }) {
  const doctorName = user?.full_name || 'Dr. Ananya Sharma';
  const initial = doctorName.replace(/^Dr\.\s*/i, '').charAt(0) || 'D';
  const speciality = user?.doctor_profile?.speciality || 'Cardiologist';

  return <aside className="doctor-sidebar" aria-label="Doctor navigation">
    <NavLink className="doctor-brand" to="/doctor/dashboard" aria-label="ArogyaNexus dashboard">
      <span className="doctor-brand-icon"><Activity size={25} /></span>
      <span>AROGYA<span>NEXUS</span></span>
    </NavLink>
    <nav className="doctor-nav">{links.map(([Icon, label, to]) => <NavLink end key={label} to={to} className={({ isActive }) => `doctor-nav-link${isActive ? ' is-active' : ''}`}>
      <Icon size={19} /><span>{label}</span>{label === 'Messages' && <span className="doctor-nav-badge">1</span>}
    </NavLink>)}</nav>
    <div className="doctor-mobile-promo"><strong>ArogyaNexus Mobile</strong><span>Access patients on the go.</span><span className="doctor-store-badges">App Store　 Google Play</span></div>
    <div className="doctor-sidebar-bottom">
      <div className="doctor-mini-profile"><span className="doctor-avatar">{initial}</span><span><strong>{doctorName}</strong><small>{speciality}</small></span></div>
      <button className="doctor-logout" type="button" onClick={onLogout}><LogOut size={17} /> Log out</button>
    </div>
  </aside>;
}

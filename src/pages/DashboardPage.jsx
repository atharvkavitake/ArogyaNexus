import React, { useEffect, useState } from 'react';
import {
  Activity, LayoutDashboard, LogOut, X, CalendarDays, Users, Clock3, FileText,
  MessageCircle, Settings, Search, PlusCircle, Bell, MapPin,
  ChevronLeft, ChevronRight, ChevronRight as ArrowRight, ChevronDown, Star,
  ClipboardList, FlaskConical, Stethoscope, CheckCircle2, CircleX, Send,
  Bot, MoreVertical, CalendarCheck, Sparkles, ShieldCheck, UserCheck, UserX,
  RefreshCw, Filter,
} from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getCurrentUser, logoutUser } from '../services/auth/authService';
import { getCsrfToken } from '../api/auth.js';
import '../styles/dashboard.css';
import DoctorSidebar from '../components/doctor/DoctorSidebar';

const dashboardPaths = {
  patient: '/patient/dashboard',
  doctor: '/doctor/dashboard',
  staff: '/staff/dashboard',
  admin: '/admin/dashboard',
};

const roleLabels = {
  patient: 'Patient',
  doctor: 'Doctor',
  staff: 'Clinical staff',
  admin: 'Administrator',
};

export default function DashboardPage({ role }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [adminApplications, setAdminApplications] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminNotice, setAdminNotice] = useState('');
  const [adminFilter, setAdminFilter] = useState('pending');
  const [reviewingId, setReviewingId] = useState('');
  const [adminReload, setAdminReload] = useState(0);
  const navigate = useNavigate();
  const [calendarMonth, setCalendarMonth] = useState(new Date(2026, 9, 1));

  useEffect(() => {
    let active = true;
    getCurrentUser().then((currentUser) => {
      if (active) {
        setUser(currentUser);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (role !== 'admin') return undefined;
    let active = true;
    setAdminLoading(true);
    setAdminError('');
    fetch('/api/admin/doctor-applications', { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Could not load doctor applications.');
        if (active) setAdminApplications(data.applications || []);
      })
      .catch((error) => { if (active) setAdminError(error.message || 'Could not load doctor applications.'); })
      .finally(() => { if (active) setAdminLoading(false); });
    return () => { active = false; };
  }, [role, adminReload]);

  const reviewDoctorApplication = async (id, status) => {
    setReviewingId(id);
    setAdminError('');
    setAdminNotice('');
    try {
      const response = await fetch(`/api/admin/doctor-applications/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not update application status.');
      setAdminApplications((applications) => applications.map((application) => application.id === id ? { ...application, status } : application));
      setAdminNotice(`${data.application?.status === 'approved' ? 'Doctor approved' : 'Application rejected'} successfully.`);
    } catch (error) {
      setAdminError(error.message || 'Could not update application status.');
    } finally {
      setReviewingId('');
    }
  };

  const confirmLogout = async () => {
    setLoggingOut(true);
    setLogoutError('');
    try {
      await logoutUser();
      navigate('/login', { replace: true });
    } catch {
      setLogoutError('Could not sign out. Please try again.');
      setLoggingOut(false);
    }
  };

  if (loading) {
    return <main className="dashboard-loading" aria-live="polite">Loading your dashboard…</main>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={dashboardPaths[user.role] || '/login'} replace />;
  if (role === 'doctor' && user.doctor_profile?.status !== 'approved') {
    return <Navigate to="/login" replace />;
  }

  const title = role === 'admin' ? 'Admin dashboard' : `${roleLabels[role]} dashboard`;

  if (role === 'doctor') {
    const monthName = calendarMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
    const calendarCells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    const appointments = [
      { time: '09:30 AM', name: 'Arjun Sharma', detail: '09:30 AM - Confirmed', status: 'Confirmed' },
      { time: '10:15 AM', name: 'Neha Kapoor', detail: '10:15 AM - Confirmed', status: 'Confirmed' },
      { time: '11:00 AM', name: 'Vikram Singh', detail: '11:00 AM - Pending', status: 'Pending' },
    ];

    return (
      <div className="doctor-dashboard">
        <DoctorSidebar user={user} onLogout={() => setShowLogoutDialog(true)} />

        <main className="doctor-workspace">
          <header className="doctor-topbar">
            <label className="doctor-search"><Search size={18} /><input aria-label="Search" placeholder="Search patients, appointments, reports..." /><kbd>× K</kbd></label>
            <div className="doctor-top-actions"><button aria-label="Create" type="button"><PlusCircle /></button><button aria-label="Messages" type="button"><MessageCircle /></button><button className="doctor-notification" aria-label="Notifications" type="button"><Bell /><i>1</i></button><div className="doctor-profile"><span className="doctor-avatar">{user.full_name?.charAt(0) || 'D'}</span><span><strong>{user.full_name}</strong><small>Cardiologist</small></span></div></div>
          </header>

          <div className="doctor-content">
            <section className="doctor-main-column">
              <div className="doctor-welcome">
                <div className="doctor-welcome-copy"><h1>Good morning, Dr. {user.full_name?.replace(/^Dr\.\s*/i, '')}!</h1><p>Saturday, October 24, 2026</p>
                  <div className="doctor-location-row"><span><CalendarDays size={18} /><b>Saturday<small>October 24, 2026</small></b></span><span><MapPin size={18} /><b>Cardiology Department<small>CityCare Multi-Specialty Hospital</small></b></span></div>
                </div>
                <div className="doctor-welcome-art" aria-hidden="true"><Stethoscope size={86} /><Sparkles size={28} /></div>
                <div className="doctor-clinical-card"><h3><span className="clinical-bot"><Bot size={17} /></span> AI Clinical Assistant</h3><p>Your AI assistant for Generator clinical summary patient summaries uit eal</p><button type="button">Generate Summary</button></div>
              </div>

              <section className="doctor-stat-grid" aria-label="Practice overview">
                {[[Users, 'Today’s Appointment', '12', '↑ +8%', 'blue'], [CalendarCheck, 'Upcoming Appointments', '24', '↑ +12%', 'amber'], [Bell, 'Pending Actions', '6', 'Action required', 'rose'], [Users, 'Total Patients', '186', '↑ +4%', 'mint'], [Star, 'Patient Rating', '4.8 ★', 'Highly rated', 'rose']].map(([Icon, label, value, foot, tint]) => <article className="doctor-stat" key={label}><span className={`doctor-stat-icon ${tint}`}><Icon size={19} /></span><span className="doctor-stat-copy"><small>{label}</small><strong>{value}</strong><em>{foot}</em></span></article>)}
              </section>

              <div className="doctor-middle-grid">
                <section className="doctor-panel doctor-appointments"><div className="doctor-panel-heading"><h2>Today’s Appointments</h2><button type="button">View all</button></div>
                  {appointments.map((appointment) => <article className="doctor-appointment-row" key={appointment.name}><span className="appointment-time">{appointment.time}</span><span className="appointment-patient"><strong>{appointment.name}</strong><small>{appointment.detail}</small></span><span className={`appointment-status ${appointment.status.toLowerCase()}`}>{appointment.status}</span></article>)}
                  <button className="doctor-schedule-link" type="button">View Full Schedule</button>
                </section>
                <section className="doctor-panel doctor-quick-links"><div className="doctor-panel-heading"><h2>Quick Links</h2></div><div className="doctor-quick-grid">{[[Users, 'Patient Records'], [CalendarDays, 'Appointments'], [FileText, 'Prescriptions'], [FlaskConical, 'Lab Reports'], [ClipboardList, 'Treatment Plans'], [Activity, 'Medical History']].map(([Icon, label]) => <button type="button" key={label}><span><Icon size={20} /></span>{label}</button>)}</div></section>
                <section className="doctor-panel doctor-queue"><div className="doctor-panel-heading"><h2>Patient Queue Status</h2><button type="button">View all</button></div><div className="doctor-queue-content"><div className="doctor-donut"><span>Total<strong>42</strong></span></div><ul><li><i className="waiting" />Waiting</li><li><i className="consult" />In Consultation</li><li><i className="completed" />Completed</li><li><i className="noshow" />No Show</li></ul></div></section>
              </div>

              <div className="doctor-bottom-grid">
                <section className="doctor-panel doctor-analytics"><div className="doctor-panel-heading"><h2>Appointment Analytics</h2><button type="button">View all</button></div><div className="doctor-chart" aria-label="Monthly appointment analytics chart">{['Jan','Feb','Mar','Apr','May','Jun','Aug','Sep','Oct','Nov','Dec'].map((month, i) => <div className="chart-month" key={month}><div className="chart-bars"><i style={{height: `${[46,70,84,52,58,62,48,70,51,57,41][i]}%`}} /><i style={{height: `${[66,57,72,48,82,78,58,48,44,72,30][i]}%`}} /><i style={{height: `${[0,0,0,31,0,80,0,0,42,0,0][i]}%`}} /></div><small>{month}</small></div>)}</div></section>
                <section className="doctor-panel doctor-pending"><div className="doctor-panel-heading"><h2>Pending Actions</h2><button type="button">View all</button></div>{[['Review blood report for Anil', true], ['Approve refill for Priya', true], ['Sign off on diagnostic summary', false]].map(([task, done]) => <button className="doctor-task" key={task} type="button"><span className={done ? 'task-check' : 'task-pending'}>{done ? <CheckCircle2 size={18} /> : <CircleX size={18} />}</span><span>{task}</span><ArrowRight size={17} /></button>)}</section>
              </div>
            </section>

            <aside className="doctor-right-column">
              <section className="doctor-panel doctor-calendar"><div className="calendar-heading"><h2>{monthName}</h2><div><button aria-label="Previous month" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}><ChevronLeft size={17} /></button><button aria-label="Next month" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}><ChevronRight size={17} /></button></div></div><div className="calendar-grid">{['SUN','MON','TUE','WED','THU','FRI','SAT'].map((day) => <b key={day}>{day}</b>)}{calendarCells.map((day, index) => <span className={day === 24 && calendarMonth.getMonth() === 9 && calendarMonth.getFullYear() === 2026 ? 'today' : ''} key={`${calendarMonth.getMonth()}-${index}`}>{day || ''}</span>)}</div></section>
              <section className="doctor-panel doctor-todays-schedule"><div className="doctor-panel-heading"><h2>Today’s Schedule</h2></div>{appointments.map((appointment, i) => <div className="doctor-timeline-row" key={appointment.name}><strong>{appointment.time}</strong><i className={`timeline-dot dot-${i}`} /><span className={`timeline-card card-${i}`}>{appointment.name.split(' ')[0]}</span></div>)}</section>
              <section className="doctor-panel doctor-assistant"><div className="assistant-heading"><span className="clinical-bot"><Bot size={19} /></span><div><h2>AI Assistant</h2><small><i /> Online</small></div><button type="button" aria-label="Assistant options"><MoreVertical size={18} /></button></div><div className="assistant-body"><div className="assistant-message"><span className="clinical-bot small"><Bot size={15} /></span><p>Hello Dr. {user.full_name?.split(' ').slice(-1)[0]}! 👋<br />How can I assist you today?</p></div><div className="assistant-suggestions"><button type="button">Summarize Patient</button><button type="button">Suggest Diagnosis</button><button type="button">Check Drug Interaction</button></div><label className="assistant-input"><input placeholder="Ask me anything..." aria-label="Ask AI assistant" /><button type="button" aria-label="Send"><Send size={17} /></button></label></div></section>
            </aside>
          </div>
        </main>

        {showLogoutDialog && (
          <div className="dashboard-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !loggingOut) setShowLogoutDialog(false); }}>
            <section className="dashboard-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-title">
              <button className="dashboard-dialog-close" type="button" aria-label="Close logout confirmation" disabled={loggingOut} onClick={() => setShowLogoutDialog(false)}><X size={19} /></button>
              <span className="dashboard-dialog-icon"><LogOut size={21} /></span><h2 id="logout-title">Log out?</h2><p>You’ll be signed out of your account and returned to the login page.</p>
              {logoutError && <p className="dashboard-dialog-error" role="alert">{logoutError}</p>}
              <div className="dashboard-dialog-actions"><button className="dashboard-button-secondary" type="button" disabled={loggingOut} onClick={() => setShowLogoutDialog(false)}>Cancel</button><button className="dashboard-button-primary" type="button" disabled={loggingOut} onClick={confirmLogout}>{loggingOut ? 'Logging out…' : 'Log out'}</button></div>
            </section>
          </div>
        )}
      </div>
    );
  }

  if (role === 'admin') {
    const pendingCount = adminApplications.filter((application) => application.status === 'pending').length;
    const visibleApplications = adminFilter === 'all' ? adminApplications : adminApplications.filter((application) => application.status === adminFilter);
    const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return (
      <div className="admin-dashboard">
        <aside className="admin-sidebar" aria-label="Administrator navigation">
          <Link className="admin-brand" to="/admin/dashboard"><span><Activity size={23} /></span><b>AROGYA<span>NEXUS</span></b></Link>
          <div className="admin-nav-label">WORKSPACE</div>
          <nav className="admin-nav"><button type="button" className="admin-nav-link active"><LayoutDashboard size={18} /> Overview</button><button type="button" className="admin-nav-link"><UserCheck size={18} /> Doctor Approvals<span>{pendingCount}</span></button><button type="button" className="admin-nav-link"><Users size={18} /> Users</button><button type="button" className="admin-nav-link"><Activity size={18} /> Activity Logs</button><button type="button" className="admin-nav-link"><Settings size={18} /> Settings</button></nav>
          <div className="admin-sidebar-bottom"><div className="admin-account"><span className="admin-avatar">{user.full_name?.trim()?.charAt(0) || 'A'}</span><span><b>{user.full_name}</b><small>Platform Administrator</small></span></div><button className="admin-logout" type="button" onClick={() => setShowLogoutDialog(true)}><LogOut size={17} /> Log out</button></div>
        </aside>

        <main className="admin-main">
          <header className="admin-topbar"><div className="admin-search"><Search size={17} /><input placeholder="Search doctors, clinics, applications..." aria-label="Search applications" /></div><div className="admin-topbar-actions"><span className="admin-date">{currentDate}</span><button type="button" aria-label="Notifications" className="admin-bell"><Bell size={20} /><i>2</i></button><span className="admin-avatar">{user.full_name?.trim()?.charAt(0) || 'A'}</span></div></header>
          <div className="admin-content">
            <section className="admin-heading"><div><p>ADMINISTRATION / OVERVIEW</p><h1>Doctor verification</h1><span>Review credentials and manage access to the ArogyaNexus network.</span></div><button type="button" className="admin-refresh" onClick={() => setAdminReload((count) => count + 1)}><RefreshCw size={16} /> Refresh list</button></section>
            <section className="admin-summary-grid"><article><span className="admin-summary-icon blue"><Users size={19} /></span><div><small>Total applications</small><b>{adminApplications.length}</b><em>All doctor registrations</em></div></article><article><span className="admin-summary-icon amber"><Clock3 size={19} /></span><div><small>Awaiting review</small><b>{pendingCount}</b><em>Needs administrator action</em></div></article><article><span className="admin-summary-icon green"><UserCheck size={19} /></span><div><small>Approved</small><b>{adminApplications.filter((application) => application.status === 'approved').length}</b><em>Verified professionals</em></div></article><article><span className="admin-summary-icon violet"><ShieldCheck size={19} /></span><div><small>Rejected</small><b>{adminApplications.filter((application) => application.status === 'rejected').length}</b><em>Applications declined</em></div></article></section>

            <section className="admin-applications-panel">
              <div className="admin-list-heading"><div><h2>Doctor applications</h2><p>Check registration details before granting clinical access.</p></div><label className="admin-filter"><Filter size={15} /><select aria-label="Filter application status" value={adminFilter} onChange={(event) => setAdminFilter(event.target.value)}><option value="pending">Pending review</option><option value="all">All applications</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><ChevronDown size={15} /></label></div>
              {adminNotice && <p className="admin-feedback success" role="status"><CheckCircle2 size={16} />{adminNotice}</p>}
              {adminError && <p className="admin-feedback error" role="alert">{adminError}</p>}
              {adminLoading ? <div className="admin-empty"><RefreshCw size={22} />Loading applications…</div> : visibleApplications.length === 0 ? <div className="admin-empty"><ShieldCheck size={25} /><b>No {adminFilter === 'all' ? '' : `${adminFilter} `}applications</b><span>Doctor registrations will appear here when submitted.</span></div> : (
                <div className="admin-application-list">{visibleApplications.map((application) => {
                  const doctor = application.user || {};
                  const statusClass = ['pending', 'approved', 'rejected'].includes(application.status) ? application.status : 'pending';
                  return <article className="admin-application-card" key={application.id}>
                    <div className="admin-doctor-identity"><span className="admin-doctor-avatar">{doctor.full_name?.trim()?.charAt(0) || 'D'}</span><div><h3>{doctor.full_name || 'Doctor applicant'}</h3><p>{doctor.email || 'Email unavailable'}{doctor.phone ? ` · ${doctor.phone}` : ''}</p><small>Applied {doctor.created_at ? new Date(doctor.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable'}</small></div><span className={`admin-status ${statusClass}`}><i />{statusClass}</span></div>
                    <div className="admin-doctor-details"><div><small>Specialty</small><b>{application.speciality}</b></div><div><small>Registration number</small><b>{application.registration_number}</b></div><div><small>Clinic / hospital</small><b>{application.clinic_name}</b></div><div><small>Consultation fee</small><b>₹{Number(application.consultation_fee || 0).toLocaleString('en-IN')}</b></div><div className="clinic-address"><small>Practice address</small><b>{application.clinic_address}</b></div></div>
                    {statusClass === 'pending' && <div className="admin-application-actions"><span>Confirm the registration details before approving.</span><div><button type="button" className="admin-reject-button" disabled={reviewingId === application.id} onClick={() => reviewDoctorApplication(application.id, 'rejected')}><UserX size={15} /> Reject</button><button type="button" className="admin-approve-button" disabled={reviewingId === application.id} onClick={() => reviewDoctorApplication(application.id, 'approved')}><CheckCircle2 size={15} />{reviewingId === application.id ? 'Saving…' : 'Approve doctor'}</button></div></div>}
                  </article>;
                })}</div>
              )}
            </section>
          </div>
        </main>
        {showLogoutDialog && <div className="dashboard-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !loggingOut) setShowLogoutDialog(false); }}><section className="dashboard-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-title"><button className="dashboard-dialog-close" type="button" aria-label="Close logout confirmation" disabled={loggingOut} onClick={() => setShowLogoutDialog(false)}><X size={19} /></button><span className="dashboard-dialog-icon"><LogOut size={21} /></span><h2 id="logout-title">Log out?</h2><p>You’ll be signed out of your account and returned to the login page.</p>{logoutError && <p className="dashboard-dialog-error" role="alert">{logoutError}</p>}<div className="dashboard-dialog-actions"><button className="dashboard-button-secondary" type="button" disabled={loggingOut} onClick={() => setShowLogoutDialog(false)}>Cancel</button><button className="dashboard-button-primary" type="button" disabled={loggingOut} onClick={confirmLogout}>{loggingOut ? 'Logging out…' : 'Log out'}</button></div></section></div>}
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
        <Link className="dashboard-brand" to={dashboardPaths[role]} aria-label="ArogyaNexus dashboard">
          <span className="dashboard-brand-mark"><Activity size={21} /></span>
          <span>ArogyaNexus</span>
        </Link>

        <nav className="dashboard-nav">
          <Link className="dashboard-nav-link active" to={dashboardPaths[role]} aria-current="page">
            <LayoutDashboard size={19} />
            <span>Dashboard</span>
          </Link>
        </nav>

        <div className="dashboard-sidebar-footer">
          <div className="dashboard-user">
            <span className="dashboard-avatar" aria-hidden="true">
              {user.full_name?.trim()?.charAt(0)?.toUpperCase() || roleLabels[role].charAt(0)}
            </span>
            <span className="dashboard-user-copy">
              <strong>{user.full_name}</strong>
              <small>{roleLabels[role]}</small>
            </span>
          </div>
          <button className="dashboard-logout-link" type="button" onClick={() => setShowLogoutDialog(true)}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">{roleLabels[role]} portal</p>
            <h1>{title}</h1>
          </div>
          <span className="dashboard-header-avatar" aria-hidden="true">
            {user.full_name?.trim()?.charAt(0)?.toUpperCase() || roleLabels[role].charAt(0)}
          </span>
        </header>
        <section className="dashboard-welcome-card" aria-labelledby="dashboard-welcome-title">
          <div className="dashboard-welcome-icon"><Activity size={24} /></div>
          <p className="dashboard-eyebrow">Your workspace</p>
          <h2 id="dashboard-welcome-title">Welcome, {user.full_name}</h2>
          <p>You’re signed in to your {roleLabels[role].toLowerCase()} account.</p>
        </section>
      </main>

      {showLogoutDialog && (
        <div className="dashboard-dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !loggingOut) setShowLogoutDialog(false);
        }}>
          <section className="dashboard-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-title">
            <button
              className="dashboard-dialog-close"
              type="button"
              aria-label="Close logout confirmation"
              disabled={loggingOut}
              onClick={() => setShowLogoutDialog(false)}
            >
              <X size={19} />
            </button>
            <span className="dashboard-dialog-icon"><LogOut size={21} /></span>
            <h2 id="logout-title">Log out?</h2>
            <p>You’ll be signed out of your account and returned to the login page.</p>
            {logoutError && <p className="dashboard-dialog-error" role="alert">{logoutError}</p>}
            <div className="dashboard-dialog-actions">
              <button className="dashboard-button-secondary" type="button" disabled={loggingOut} onClick={() => setShowLogoutDialog(false)}>
                Cancel
              </button>
              <button className="dashboard-button-primary" type="button" disabled={loggingOut} onClick={confirmLogout}>
                {loggingOut ? 'Logging out…' : 'Log out'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

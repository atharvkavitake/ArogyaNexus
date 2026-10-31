import React, { useEffect, useState } from 'react';
import {
  Activity, LayoutDashboard, LogOut, X, CalendarDays, Users, Clock3, FileText,
  MessageCircle, Settings, Search, PlusCircle, Bell, MapPin,
  ChevronLeft, ChevronRight, ArrowRight, ChevronDown, Star,
  ClipboardList, FlaskConical, Stethoscope, CheckCircle2, CircleX,
  CalendarCheck, Sparkles, ShieldCheck, UserCheck, UserX,
  RefreshCw, Filter,
} from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getCurrentUser, logoutUser } from '../services/auth/authService';
import { getDoctorAppointments, getDoctorAppointmentCounts } from '../api/doctorAppointments';
import { getChatConversations } from '../api/chat';
import '../styles/dashboard.css';
import DoctorSidebar from '../components/doctor/DoctorSidebar';

const dashboardPaths = {
  patient: '/patient/dashboard',
  doctor: '/doctor/dashboard',
  admin: '/admin/dashboard',
};

const roleLabels = {
  patient: 'Patient',
  doctor: 'Doctor',
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
  const [docTodayAppointments, setDocTodayAppointments] = useState([]);
  const [docUpcomingAppointments, setDocUpcomingAppointments] = useState([]);
  const [docCounts, setDocCounts] = useState({ today: 0, upcoming: 0, requests: 0 });
  const [docQueueCounts, setDocQueueCounts] = useState({ waiting: 0, consult: 0, completed: 0, noshow: 0, total: 0 });
  const [docConversations, setDocConversations] = useState([]);

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
    if (role !== 'doctor') return undefined;
    let active = true;
    const fetchDocData = async () => {
      try {
        const [todayList, upcomingList, counts, conversations] = await Promise.all([
          getDoctorAppointments({ tab: 'today' }),
          getDoctorAppointments({ tab: 'upcoming' }),
          getDoctorAppointmentCounts(),
          getChatConversations('doctor'),
        ]);
        if (!active) return;
        const list = Array.isArray(todayList) ? todayList : [];
        setDocTodayAppointments(list);
        setDocUpcomingAppointments(Array.isArray(upcomingList) ? upcomingList : []);
        setDocCounts(counts && typeof counts === 'object' ? counts : { today: 0, upcoming: 0, requests: 0 });
        setDocConversations(Array.isArray(conversations) ? conversations : []);

        const waiting = list.filter((a) => (a.status || '').toUpperCase() === 'WAITING').length;
        const consult = list.filter((a) => (a.status || '').toUpperCase() === 'IN_CONSULTATION').length;
        const completed = list.filter((a) => (a.status || '').toUpperCase() === 'COMPLETED').length;
        const noshow = list.filter((a) => (a.status || '').toUpperCase() === 'NO_SHOW').length;
        setDocQueueCounts({
          waiting,
          consult,
          completed,
          noshow,
          total: list.length,
        });
      } catch (err) {
        console.warn('Could not load doctor dashboard appointments:', err);
      }
    };
    fetchDocData();
    const interval = setInterval(fetchDocData, 8000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [role]);

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
        headers: { 'Content-Type': 'application/json' },
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

  const defaultDoctor = {
    id: '22222222-2222-4222-a222-222222222222',
    full_name: 'Dr. Ananya S. Sharma',
    role: 'doctor',
    doctor_profile: { status: 'approved', speciality: 'Cardiologist', clinic_name: 'Apex Multi-Specialty Heart Center' },
  };

  const effectiveUser = role === 'doctor'
    ? (user?.role === 'doctor' ? { ...user, doctor_profile: user.doctor_profile || defaultDoctor.doctor_profile } : defaultDoctor)
    : user;

  if (!effectiveUser) return <Navigate to="/login" replace />;
  if (role !== 'doctor' && effectiveUser.role !== role) {
    return <Navigate to={dashboardPaths[effectiveUser.role] || '/login'} replace />;
  }

  const title = role === 'admin' ? 'Admin dashboard' : `${roleLabels[role]} dashboard`;

  if (role === 'doctor') {
    const monthName = calendarMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
    const calendarCells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

    const now = new Date();
    const todayFormatted = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDayYear = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const totalPatientsCount = new Set(
      (Array.isArray(docTodayAppointments) ? docTodayAppointments : [])
        .concat(Array.isArray(docUpcomingAppointments) ? docUpcomingAppointments : [])
        .map((a) => a?.patient?.name)
        .filter(Boolean)
    ).size;

    return (
      <div className="doctor-dashboard">
        <DoctorSidebar user={effectiveUser} onLogout={() => setShowLogoutDialog(true)} />

        <main className="doctor-workspace">
          <header className="doctor-topbar">
            <label className="doctor-search"><Search size={18} /><input aria-label="Search" placeholder="Search patients, appointments, reports..." /><kbd>× K</kbd></label>
            <div className="doctor-top-actions"><button aria-label="Create" type="button" onClick={() => navigate('/doctor/appointments')}><PlusCircle /></button><button aria-label="Messages" type="button" onClick={() => navigate('/doctor/messages')}><MessageCircle /></button><button className="doctor-notification" aria-label="Notifications" type="button"><Bell /><i>{docCounts.requests || 0}</i></button><div className="doctor-profile"><span className="doctor-avatar">{effectiveUser.full_name?.charAt(0) || 'D'}</span><span><strong>{effectiveUser.full_name}</strong><small>{effectiveUser.doctor_profile?.speciality || 'Cardiologist'}</small></span></div></div>
          </header>

          <div className="doctor-content">
            <section className="doctor-main-column">
              <div className="doctor-welcome">
                <div className="doctor-welcome-copy">
                  <h1>Good morning, Dr. {effectiveUser.full_name?.replace(/^Dr\.\s*/i, '')}!</h1>
                  <p>{todayFormatted}</p>
                  <div className="doctor-location-row">
                    <span><CalendarDays size={18} /><b>{weekday}<small>{monthDayYear}</small></b></span>
                    <span><MapPin size={18} /><b>{effectiveUser.doctor_profile?.speciality || 'Cardiology'} Department<small>{effectiveUser.doctor_profile?.clinic_name || 'Apex Multi-Specialty Heart Center'}</small></b></span>
                  </div>
                </div>
                <div className="doctor-welcome-art" aria-hidden="true" style={{ right: '36px' }}><Stethoscope size={86} /><Sparkles size={28} /></div>
              </div>

              <section className="doctor-stat-grid" aria-label="Practice overview">
                {[[Users, 'Today’s Appointment', String(docCounts.today), `${docCounts.today} scheduled`, 'blue'], [CalendarCheck, 'Upcoming Appointments', String(docCounts.upcoming), `${docCounts.upcoming} upcoming`, 'amber'], [Bell, 'Pending Requests', String(docCounts.requests), 'Action required', 'rose'], [Users, 'Total Patients', String(totalPatientsCount), 'Active roster', 'mint'], [Star, 'Patient Rating', '4.9 ★', 'Highly rated', 'rose']].map(([Icon, label, value, foot, tint]) => <article className="doctor-stat" key={label}><span className={`doctor-stat-icon ${tint}`}><Icon size={19} /></span><span className="doctor-stat-copy"><small>{label}</small><strong>{value}</strong><em>{foot}</em></span></article>)}
              </section>

              <div className="doctor-middle-grid">
                <section className="doctor-panel doctor-appointments"><div className="doctor-panel-heading"><h2>Today’s Appointments</h2><button type="button" onClick={() => navigate('/doctor/appointments')}>View all</button></div>
                  {Array.isArray(docTodayAppointments) && docTodayAppointments.length > 0 ? (
                    docTodayAppointments.map((appointment, idx) => {
                      let timeStr = '10:00 AM';
                      try {
                        const rawDate = appointment.startsAt || appointment.appointment_at || appointment.starts_at;
                        const d = rawDate ? new Date(rawDate) : new Date();
                        if (!isNaN(d.getTime())) {
                          timeStr = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(d);
                        }
                      } catch {}

                      const aptStatus = appointment.status || 'CONFIRMED';
                      return (
                        <article className="doctor-appointment-row" key={appointment.id || idx}>
                          <span className="appointment-time">{timeStr}</span>
                          <span className="appointment-patient">
                            <strong>{appointment.patient?.name || appointment.doctorName || 'Patient'}</strong>
                            <small>{appointment.reason || 'General Consultation'}</small>
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className={`appointment-status ${aptStatus.toLowerCase()}`}>
                              {aptStatus.replace(/_/g, ' ')}
                            </span>
                            <button
                              type="button"
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: '1px solid #b9d7dc',
                                background: '#edf7f8',
                                color: '#136773',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/doctor/messages?patient=${appointment.patient?.id || appointment.patient_id || 'demo-patient'}`);
                              }}
                              title="Chat with Patient"
                            >
                              <MessageCircle size={12} /> Chat
                            </button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#687b87', fontSize: '13px' }}>
                      <p style={{ margin: '0 0 10px' }}>No appointments scheduled for today.</p>
                      <button
                        type="button"
                        onClick={() => navigate('/doctor/appointments')}
                        style={{ color: '#167c84', background: '#eaf4f5', border: '1px solid #c8dfe2', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                      >
                        View All Appointments
                      </button>
                    </div>
                  )}
                  <button className="doctor-schedule-link" type="button" onClick={() => navigate('/doctor/appointments')}>View Full Schedule</button>
                </section>
                <section className="doctor-panel doctor-quick-links"><div className="doctor-panel-heading"><h2>Quick Links</h2></div><div className="doctor-quick-grid">{[[CalendarDays, 'Appointments', '/doctor/appointments'], [Settings, 'Settings', '/doctor/settings'], [MessageCircle, 'Messages', '/doctor/messages']].map(([Icon, label, link]) => <button type="button" key={label} onClick={() => navigate(link)}><span><Icon size={20} /></span>{label}</button>)}</div></section>
                <section className="doctor-panel doctor-queue"><div className="doctor-panel-heading"><h2>Patient Queue Status</h2><button type="button" onClick={() => navigate('/doctor/appointments')}>View all</button></div><div className="doctor-queue-content"><div className="doctor-donut"><span>Total<strong>{docQueueCounts.total}</strong></span></div><ul><li><i className="waiting" />Waiting ({docQueueCounts.waiting})</li><li><i className="consult" />In Consultation ({docQueueCounts.consult})</li><li><i className="completed" />Completed ({docQueueCounts.completed})</li><li><i className="noshow" />No Show ({docQueueCounts.noshow})</li></ul></div></section>
              </div>

              <section className="doctor-panel doctor-chats-panel" style={{ padding: '14px 16px' }}>
                <div className="doctor-panel-heading" style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageCircle size={18} style={{ color: '#167c84' }} />
                    <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Patient Consultation Messages</h2>
                    {Array.isArray(docConversations) && docConversations.some((c) => c && ((c.unreadCount || c.unread || 0) > 0)) && (
                      <span style={{ fontSize: '10px', background: '#e11d48', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontWeight: 700 }}>
                        {docConversations.reduce((sum, c) => sum + ((c && (c.unreadCount || c.unread)) || 0), 0)} new
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/doctor/messages')}
                    style={{ fontWeight: 650, color: '#167c84', cursor: 'pointer', background: 'transparent', border: 0, fontSize: '12px' }}
                  >
                    Open Messages Center →
                  </button>
                </div>

                <div className="doctor-chat-preview-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                  {Array.isArray(docConversations) && docConversations.length > 0 ? (
                    docConversations.slice(0, 3).map((conv, idx) => {
                      if (!conv) return null;
                      const participant = conv.participant || {};
                      const participantId = participant.id || conv.id || 'demo-patient';
                      const participantName = participant.name || conv.name || 'Patient';
                      const initials = conv.initials || participantName.split(' ').map((p) => p[0]).join('').slice(0, 2) || 'PT';
                      const lastMsgSnippet = typeof conv.lastMessage === 'string'
                        ? conv.lastMessage
                        : (conv.lastMessage?.text || 'Consultation chat thread');
                      const unreadCount = conv.unreadCount ?? conv.unread ?? 0;
                      let timeStr = conv.time || 'Recent';
                      if (!conv.time && conv.lastMessage?.timestamp) {
                        try {
                          const d = new Date(conv.lastMessage.timestamp);
                          if (!isNaN(d.getTime())) {
                            timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          }
                        } catch {}
                      }

                      return (
                        <div
                          key={participantId || idx}
                          onClick={() => navigate(`/doctor/messages?patient=${encodeURIComponent(participantId)}`)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            borderRadius: '10px',
                            border: (unreadCount > 0) ? '1px solid #99d2d0' : '1px solid #e1e7ec',
                            background: (unreadCount > 0) ? '#f0f9f8' : '#fcfdfe',
                            cursor: 'pointer',
                          }}
                          className="doctor-chat-item-card"
                        >
                          <span
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              background: conv.avatarColor || '#0d9488',
                              color: '#fff',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 700,
                              fontSize: '13px',
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <strong style={{ fontSize: '12px', color: '#1a2936' }}>{participantName}</strong>
                              <small style={{ fontSize: '10px', color: '#7a8b98' }}>{timeStr}</small>
                            </div>
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#526573', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {lastMsgSnippet}
                            </p>
                          </div>
                          {unreadCount > 0 && (
                            <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#277bc1', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                              {unreadCount}
                            </span>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px', gridColumn: '1 / -1' }}>
                      <p style={{ margin: '0 0 8px' }}>No active patient consultation messages.</p>
                      <button
                        type="button"
                        onClick={() => navigate('/doctor/messages')}
                        style={{ color: '#167c84', background: '#eaf4f5', border: '1px solid #c8dfe2', padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Start Consultation Chat
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <div className="doctor-bottom-grid">
                <section className="doctor-panel doctor-analytics"><div className="doctor-panel-heading"><h2>Appointment Analytics</h2><button type="button">View all</button></div><div className="doctor-chart" aria-label="Monthly appointment analytics chart">{['Jan','Feb','Mar','Apr','May','Jun','Aug','Sep','Oct','Nov','Dec'].map((month, i) => <div className="chart-month" key={month}><div className="chart-bars"><i style={{height: `${[46,70,84,52,58,62,48,70,51,57,41][i]}%`}} /><i style={{height: `${[66,57,72,48,82,78,58,48,44,72,30][i]}%`}} /><i style={{height: `${[0,0,0,31,0,80,0,0,42,0,0][i]}%`}} /></div><small>{month}</small></div>)}</div></section>
                <section className="doctor-panel doctor-pending"><div className="doctor-panel-heading"><h2>Pending Actions</h2><button type="button" onClick={() => navigate('/doctor/appointments')}>View all</button></div>{[[`Review ${docCounts.requests} pending appointment request(s)`, docCounts.requests === 0], ['Complete doctor profile verification', true], ['Check encrypted medical record authorizations', true]].map(([task, done]) => <button className="doctor-task" key={task} type="button" onClick={() => navigate('/doctor/appointments')}><span className={done ? 'task-check' : 'task-pending'}>{done ? <CheckCircle2 size={18} /> : <CircleX size={18} />}</span><span>{task}</span><ArrowRight size={17} /></button>)}</section>
              </div>
            </section>

            <aside className="doctor-right-column">
              <section className="doctor-panel doctor-calendar"><div className="calendar-heading"><h2>{monthName}</h2><div><button aria-label="Previous month" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}><ChevronLeft size={17} /></button><button aria-label="Next month" type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}><ChevronRight size={17} /></button></div></div><div className="calendar-grid">{['SUN','MON','TUE','WED','THU','FRI','SAT'].map((day) => <b key={day}>{day}</b>)}{calendarCells.map((day, index) => <span className={day === now.getDate() && calendarMonth.getMonth() === now.getMonth() && calendarMonth.getFullYear() === now.getFullYear() ? 'today' : ''} key={`${calendarMonth.getMonth()}-${index}`}>{day || ''}</span>)}</div></section>
              <section className="doctor-panel doctor-todays-schedule"><div className="doctor-panel-heading"><h2>Today’s Schedule</h2></div>{Array.isArray(docTodayAppointments) && docTodayAppointments.length > 0 ? (
                docTodayAppointments.map((appointment, i) => {
                  let timeStr = '10:00 AM';
                  try {
                    const rawDate = appointment.startsAt || appointment.appointment_at || appointment.starts_at;
                    const d = rawDate ? new Date(rawDate) : new Date();
                    if (!isNaN(d.getTime())) {
                      timeStr = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(d);
                    }
                  } catch {}
                  return (
                    <div className="doctor-timeline-row" key={appointment.id || i}>
                      <strong>{timeStr}</strong>
                      <i className={`timeline-dot dot-${i % 3}`} />
                      <span className={`timeline-card card-${i % 3}`}>{(appointment.patient?.name || appointment.doctorName || 'Patient').split(' ')[0]}</span>
                    </div>
                  );
                })
              ) : (
                <p style={{ padding: '16px', color: '#728591', fontSize: '12px', textAlign: 'center', margin: 0 }}>No schedule for today.</p>
              )}</section>
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

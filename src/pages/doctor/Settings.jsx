import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Award,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Globe,
  IndianRupee,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
  Video,
} from 'lucide-react';
import DoctorSidebar from '../../components/doctor/DoctorSidebar';
import { getCurrentUser, logoutUser } from '../../services/auth/authService';
import '../../styles/dashboard.css';
import '../../styles/doctor-appointments.css';
import '../../styles/doctor-settings.css';

const SPECIALITIES = [
  'Cardiology',
  'Dermatology',
  'Neurology',
  'Orthopedics',
  'Pediatrics',
  'General Medicine',
  'Gynecology & Obstetrics',
  'Ophthalmology',
  'Oncology',
  'Psychiatry',
  'ENT (Otolaryngology)',
  'Dentistry',
];

export default function DoctorSettings({ onToast }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  // Doctor state
  const [doctorUser, setDoctorUser] = useState({
    id: '',
    full_name: 'Dr. Ananya Sharma',
    email: 'd@gmail.com',
    phone: '+91 98765 43210',
    role: 'doctor',
  });

  // Profile fields state
  const [form, setForm] = useState({
    full_name: 'Dr. Ananya Sharma',
    phone: '+91 98765 43210',
    speciality: 'Cardiology',
    registration_number: 'MCI-2020-88491',
    clinic_name: 'Apex Multi-Specialty Heart Center',
    clinic_address: 'Suite 400, Medical Boulevard, Pune, Maharashtra 411001',
    consultation_fee: 150,
    experience_years: 12,
    languages: 'English, Hindi, Marathi',
    bio: 'Experienced cardiologist specializing in preventive cardiology and cardiovascular wellness with over 12 years of clinical excellence.',
    offers_video: true,
  });

  // Password state
  const [pwd, setPwd] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  const showNotification = useCallback((message, type = 'success') => {
    setNotice({ message, type });
    if (onToast) {
      onToast({
        title: type === 'success' ? 'Success' : 'Notice',
        message,
        type,
      });
    }
    setTimeout(() => {
      setNotice(null);
    }, 5000);
  }, [onToast]);

  // Load doctor details
  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/doctor/profile', {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.doctor) {
          const doc = json.doctor;
          const prof = doc.doctor_profile || {};
          setDoctorUser({
            id: doc.id,
            full_name: doc.full_name || 'Dr. Ananya Sharma',
            email: doc.email || 'd@gmail.com',
            phone: doc.phone || '+91 98765 43210',
            role: doc.role || 'doctor',
            doctor_profile: prof,
          });

          setForm({
            full_name: doc.full_name || 'Dr. Ananya Sharma',
            phone: doc.phone || '+91 98765 43210',
            speciality: prof.speciality || 'Cardiology',
            registration_number: prof.registration_number || 'MCI-2020-88491',
            clinic_name: prof.clinic_name || 'Apex Multi-Specialty Heart Center',
            clinic_address: prof.clinic_address || 'Suite 400, Medical Boulevard, Pune, Maharashtra 411001',
            consultation_fee: prof.consultation_fee ?? 150,
            experience_years: prof.experience_years ?? 12,
            languages: Array.isArray(prof.languages) ? prof.languages.join(', ') : (prof.languages || 'English, Hindi, Marathi'),
            bio: prof.bio || 'Experienced cardiologist specializing in preventive cardiology and cardiovascular wellness.',
            offers_video: prof.offers_video ?? true,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load doctor profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Save profile changes
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      const languagesArray = form.languages
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/doctor/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          full_name: form.full_name,
          phone: form.phone,
          speciality: form.speciality,
          clinic_name: form.clinic_name,
          clinic_address: form.clinic_address,
          consultation_fee: Number(form.consultation_fee),
          experience_years: Number(form.experience_years),
          languages: languagesArray,
          bio: form.bio,
          offers_video: Boolean(form.offers_video),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update profile.');
      }

      // Update state with newly saved info
      const doc = data.doctor;
      setDoctorUser({
        ...doctorUser,
        full_name: doc.full_name,
        phone: doc.phone,
        doctor_profile: doc.doctor_profile,
      });

      showNotification('Profile updated successfully!', 'success');
    } catch (err) {
      showNotification(err.message || 'Could not update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Change password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwd.newPassword.length < 8) {
      showNotification('New password must be at least 8 characters long.', 'error');
      return;
    }
    if (pwd.newPassword !== pwd.confirmPassword) {
      showNotification('New passwords do not match.', 'error');
      return;
    }

    setPwdSaving(true);
    setNotice(null);

    try {
      const res = await fetch('/api/doctor/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: pwd.currentPassword,
          newPassword: pwd.newPassword,
          confirmPassword: pwd.confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update password.');
      }

      setPwd({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showNotification('Password updated successfully! Your account is secure.', 'success');
    } catch (err) {
      showNotification(err.message || 'Could not change password.', 'error');
    } finally {
      setPwdSaving(false);
    }
  };

  const initial = doctorUser.full_name?.replace(/^Dr\.\s*/i, '').charAt(0) || 'D';
  const cleanName = doctorUser.full_name?.replace(/^Dr\.\s*/i, '') || 'Doctor';

  return (
    <div className="doctor-dashboard">
      <DoctorSidebar
        user={doctorUser}
        onLogout={() =>
          logoutUser()
            .then(() => navigate('/login'))
            .catch(() => showNotification('Could not sign out.', 'error'))
        }
      />
      <main className="doctor-workspace">
        <header className="doctor-topbar">
          <div className="doctor-appointments-title">
            <p>Practice Settings & Security</p>
            <h1>Doctor Profile & Settings</h1>
          </div>
          <div className="doctor-top-actions">
            <button
              aria-label="Messages"
              type="button"
              onClick={() => navigate('/doctor/messages')}
            >
              <MessageCircle />
            </button>
            <div className="doctor-profile">
              <span className="doctor-avatar">{initial}</span>
              <span>
                <strong>{doctorUser.full_name}</strong>
                <small>{form.speciality || 'Specialist'}</small>
              </span>
            </div>
          </div>
        </header>

        <div className="doctor-settings-content">
          <div className="doctor-settings-header">
            <div>
              <h1>Doctor Account Settings</h1>
              <p>Update your personal information, consultation practice details, and account credentials.</p>
            </div>
            <div className="doctor-verified-badge">
              <ShieldCheck size={16} /> Verified Practitioner
            </div>
          </div>

          {notice && (
            <div className={`doctor-notice ${notice.type}`} role="status">
              <span>{notice.message}</span>
              <button onClick={() => setNotice(null)} aria-label="Dismiss notice">
                &times;
              </button>
            </div>
          )}

          {/* Hero Profile Overview Card */}
          <div className="doctor-hero-profile">
            <div className="doctor-hero-avatar">{initial}</div>
            <div className="doctor-hero-info">
              <h3>{doctorUser.full_name}</h3>
              <div className="doctor-hero-meta">
                <span className="doctor-hero-pill">
                  <Stethoscope size={13} /> {form.speciality}
                </span>
                <span className="doctor-hero-pill">
                  <Award size={13} /> Reg No: {form.registration_number}
                </span>
                <span className="doctor-hero-pill">
                  <Clock size={13} /> {form.experience_years} Years Experience
                </span>
                <span className="doctor-hero-pill">
                  <IndianRupee size={13} /> ₹{form.consultation_fee} per visit
                </span>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="doctor-settings-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'profile'}
              className={`doctor-settings-tab ${tab === 'profile' ? 'active' : ''}`}
              onClick={() => setTab('profile')}
            >
              <User size={16} /> Profile & Identity
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'clinic'}
              className={`doctor-settings-tab ${tab === 'clinic' ? 'active' : ''}`}
              onClick={() => setTab('clinic')}
            >
              <Building2 size={16} /> Clinic & Consultations
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'security'}
              className={`doctor-settings-tab ${tab === 'security' ? 'active' : ''}`}
              onClick={() => setTab('security')}
            >
              <KeyRound size={16} /> Password & Security
            </button>
          </div>

          {/* Tab 1: Profile & Identity */}
          {tab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="doctor-card">
              <div className="doctor-card-header">
                <div className="doctor-card-icon">
                  <User size={22} />
                </div>
                <div>
                  <h2>Personal & Professional Information</h2>
                  <p>These details are displayed to patients searching for healthcare providers on ArogyaNexus.</p>
                </div>
              </div>

              <div className="doctor-form-grid">
                <div className="doctor-form-group">
                  <label className="doctor-form-label">
                    Full Name <small>(e.g. Dr. Firstname Lastname)</small>
                  </label>
                  <div className="doctor-input-wrapper">
                    <User size={16} className="doctor-input-icon" />
                    <input
                      required
                      className="doctor-input"
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      placeholder="Dr. Ananya Sharma"
                    />
                  </div>
                </div>

                <div className="doctor-form-group">
                  <label className="doctor-form-label">
                    Email Address <small>(Registered ID)</small>
                  </label>
                  <div className="doctor-input-wrapper">
                    <Mail size={16} className="doctor-input-icon" />
                    <input
                      readOnly
                      disabled
                      className="doctor-input"
                      value={doctorUser.email}
                      title="Email is verified and cannot be changed directly."
                    />
                  </div>
                </div>

                <div className="doctor-form-group">
                  <label className="doctor-form-label">Phone Number</label>
                  <div className="doctor-input-wrapper">
                    <Phone size={16} className="doctor-input-icon" />
                    <input
                      type="tel"
                      className="doctor-input"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div className="doctor-form-group">
                  <label className="doctor-form-label">
                    Medical Registration Number <small>(Verified with MCI / MMC)</small>
                  </label>
                  <div className="doctor-input-wrapper">
                    <Award size={16} className="doctor-input-icon" />
                    <input
                      readOnly
                      disabled
                      className="doctor-input"
                      value={form.registration_number}
                    />
                  </div>
                </div>

                <div className="doctor-form-group">
                  <label className="doctor-form-label">Primary Speciality</label>
                  <div className="doctor-input-wrapper">
                    <Stethoscope size={16} className="doctor-input-icon" />
                    <select
                      className="doctor-input"
                      value={form.speciality}
                      onChange={(e) => setForm({ ...form, speciality: e.target.value })}
                    >
                      {SPECIALITIES.map((spec) => (
                        <option key={spec} value={spec}>
                          {spec}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="doctor-form-group">
                  <label className="doctor-form-label">Experience (Years)</label>
                  <div className="doctor-input-wrapper">
                    <Clock size={16} className="doctor-input-icon" />
                    <input
                      type="number"
                      min="0"
                      max="60"
                      className="doctor-input"
                      value={form.experience_years}
                      onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
                    />
                  </div>
                </div>

                <div className="doctor-form-group full-width">
                  <label className="doctor-form-label">
                    Languages Spoken <small>(Comma-separated)</small>
                  </label>
                  <div className="doctor-input-wrapper">
                    <Globe size={16} className="doctor-input-icon" />
                    <input
                      className="doctor-input"
                      value={form.languages}
                      onChange={(e) => setForm({ ...form, languages: e.target.value })}
                      placeholder="English, Hindi, Marathi"
                    />
                  </div>
                </div>

                <div className="doctor-form-group full-width">
                  <label className="doctor-form-label">Doctor Bio & Clinical Focus</label>
                  <textarea
                    rows={4}
                    className="doctor-textarea"
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    placeholder="Describe your medical background, specialization, and approach to care..."
                  />
                </div>
              </div>

              <div className="doctor-form-actions">
                <button
                  type="button"
                  className="doctor-btn doctor-btn-secondary"
                  onClick={fetchProfile}
                  disabled={saving}
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="doctor-btn doctor-btn-primary"
                  disabled={saving}
                >
                  <Save size={16} />
                  {saving ? 'Saving changes...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          )}

          {/* Tab 2: Clinic & Consultations */}
          {tab === 'clinic' && (
            <form onSubmit={handleSaveProfile} className="doctor-card">
              <div className="doctor-card-header">
                <div className="doctor-card-icon">
                  <Building2 size={22} />
                </div>
                <div>
                  <h2>Practice Location & Consultation Preferences</h2>
                  <p>Manage your clinic affiliation, visit modes, and patient consultation fees.</p>
                </div>
              </div>

              <div className="doctor-form-grid">
                <div className="doctor-form-group">
                  <label className="doctor-form-label">Clinic / Hospital Name</label>
                  <div className="doctor-input-wrapper">
                    <Building2 size={16} className="doctor-input-icon" />
                    <input
                      className="doctor-input"
                      value={form.clinic_name}
                      onChange={(e) => setForm({ ...form, clinic_name: e.target.value })}
                      placeholder="e.g. Apex Multi-Specialty Heart Center"
                    />
                  </div>
                </div>

                <div className="doctor-form-group">
                  <label className="doctor-form-label">Consultation Fee (₹)</label>
                  <div className="doctor-input-wrapper">
                    <IndianRupee size={16} className="doctor-input-icon" />
                    <input
                      type="number"
                      min="0"
                      step="50"
                      className="doctor-input"
                      value={form.consultation_fee}
                      onChange={(e) => setForm({ ...form, consultation_fee: e.target.value })}
                      placeholder="150"
                    />
                  </div>
                </div>

                <div className="doctor-form-group full-width">
                  <label className="doctor-form-label">Clinic Address</label>
                  <div className="doctor-input-wrapper">
                    <MapPin size={16} className="doctor-input-icon" />
                    <input
                      className="doctor-input"
                      value={form.clinic_address}
                      onChange={(e) => setForm({ ...form, clinic_address: e.target.value })}
                      placeholder="Suite / Floor, Street, City, State, PIN"
                    />
                  </div>
                </div>

                <div className="doctor-form-group full-width">
                  <div className="doctor-toggle-card">
                    <div className="doctor-toggle-info">
                      <strong>Offer Video Consultations</strong>
                      <span>Allow patients to book remote telemedicine visits via encrypted video call</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.offers_video}
                      className={`doctor-switch ${form.offers_video ? 'on' : ''}`}
                      onClick={() => setForm({ ...form, offers_video: !form.offers_video })}
                    >
                      <span className="doctor-switch-thumb" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="doctor-form-actions">
                <button
                  type="button"
                  className="doctor-btn doctor-btn-secondary"
                  onClick={fetchProfile}
                  disabled={saving}
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="doctor-btn doctor-btn-primary"
                  disabled={saving}
                >
                  <Save size={16} />
                  {saving ? 'Saving changes...' : 'Save Practice Details'}
                </button>
              </div>
            </form>
          )}

          {/* Tab 3: Password & Security */}
          {tab === 'security' && (
            <form onSubmit={handleChangePassword} className="doctor-card">
              <div className="doctor-card-header">
                <div className="doctor-card-icon">
                  <KeyRound size={22} />
                </div>
                <div>
                  <h2>Change Password</h2>
                  <p>Choose a strong password to protect your doctor portal and clinical medical records.</p>
                </div>
              </div>

              <div className="doctor-form-grid">
                <div className="doctor-form-group full-width">
                  <label className="doctor-form-label">Current Password</label>
                  <div className="doctor-password-wrapper">
                    <Lock size={16} className="doctor-input-icon" />
                    <input
                      required
                      type={showCurrentPwd ? 'text' : 'password'}
                      className="doctor-input"
                      placeholder="Enter your current password"
                      value={pwd.currentPassword}
                      onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })}
                    />
                    <button
                      type="button"
                      className="doctor-eye-btn"
                      onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                      aria-label={showCurrentPwd ? 'Hide password' : 'Show password'}
                    >
                      {showCurrentPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="doctor-form-group">
                  <label className="doctor-form-label">New Password</label>
                  <div className="doctor-password-wrapper">
                    <Lock size={16} className="doctor-input-icon" />
                    <input
                      required
                      type={showNewPwd ? 'text' : 'password'}
                      className="doctor-input"
                      placeholder="At least 8 characters"
                      value={pwd.newPassword}
                      onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })}
                    />
                    <button
                      type="button"
                      className="doctor-eye-btn"
                      onClick={() => setShowNewPwd(!showNewPwd)}
                      aria-label={showNewPwd ? 'Hide password' : 'Show password'}
                    >
                      {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="doctor-form-group">
                  <label className="doctor-form-label">Confirm New Password</label>
                  <div className="doctor-password-wrapper">
                    <Lock size={16} className="doctor-input-icon" />
                    <input
                      required
                      type={showConfirmPwd ? 'text' : 'password'}
                      className="doctor-input"
                      placeholder="Re-type new password"
                      value={pwd.confirmPassword}
                      onChange={(e) => setPwd({ ...pwd, confirmPassword: e.target.value })}
                    />
                    <button
                      type="button"
                      className="doctor-eye-btn"
                      onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                      aria-label={showConfirmPwd ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="doctor-form-group full-width">
                  <div className="doctor-security-hints">
                    <div
                      className={`doctor-security-hint-item ${
                        pwd.newPassword.length >= 8 ? 'valid' : ''
                      }`}
                    >
                      <CheckCircle2 size={14} /> At least 8 characters long
                    </div>
                    <div
                      className={`doctor-security-hint-item ${
                        pwd.newPassword.length > 0 &&
                        pwd.newPassword === pwd.confirmPassword
                          ? 'valid'
                          : ''
                      }`}
                    >
                      <CheckCircle2 size={14} /> Passwords match
                    </div>
                  </div>
                </div>
              </div>

              <div className="doctor-form-actions">
                <button
                  type="submit"
                  className="doctor-btn doctor-btn-primary"
                  disabled={
                    pwdSaving ||
                    pwd.newPassword.length < 8 ||
                    pwd.newPassword !== pwd.confirmPassword
                  }
                >
                  <KeyRound size={16} />
                  {pwdSaving ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

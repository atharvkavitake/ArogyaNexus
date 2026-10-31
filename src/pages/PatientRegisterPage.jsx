import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, Phone, ArrowRight } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import AuthBranding from '../components/auth/AuthBranding';
import AuthInput from '../components/auth/AuthInput';
import PasswordInput from '../components/auth/PasswordInput';
import PasswordStrength from '../components/auth/PasswordStrength';
import AuthButton from '../components/auth/AuthButton';
import AuthError from '../components/auth/AuthError';
import AuthSuccess from '../components/auth/AuthSuccess';
import TrustIndicators from '../components/auth/TrustIndicators';
import { registerPatient } from '../services/auth/authService';

export default function PatientRegisterPage({ onToast }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = () => {
    const errs = {};
    if (!formData.fullName.trim()) {
      errs.fullName = 'Please enter your full name.';
    }

    if (!formData.email.trim()) {
      errs.email = 'Please enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }

    if (!formData.phoneNumber.trim()) {
      errs.phoneNumber = 'Please enter your phone number.';
    } else if (!/^[+]?\d[\d\s().-]{5,23}\d$/.test(formData.phoneNumber.trim())) {
      errs.phoneNumber = 'Please enter a valid phone number (e.g., +1 234-567-8900).';
    }

    if (!formData.password) {
      errs.password = 'Please enter your password.';
    } else if (formData.password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    } else if (!/[A-Z]/.test(formData.password)) {
      errs.password = 'Password must contain at least one uppercase letter.';
    } else if (!/[0-9]/.test(formData.password)) {
      errs.password = 'Password must contain at least one number.';
    } else if (!/[^A-Za-z0-9]/.test(formData.password)) {
      errs.password = 'Password must contain at least one special character.';
    }

    if (!formData.confirmPassword) {
      errs.confirmPassword = 'Please confirm your password.';
    } else if (formData.password !== formData.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    setSuccessMessage('');

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      await registerPatient({
        fullName: formData.fullName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      setSuccessMessage(
        `Welcome to MedNexus, ${formData.fullName}! Your patient account has been created. You can now sign in.`
      );
      if (onToast) {
        onToast({
          type: 'success',
          title: 'Account Created',
          message: `Patient account for ${formData.email} registered successfully.`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setGeneralError(msg);
      if (onToast) {
        onToast({
          type: 'error',
          title: 'Registration Error',
          message: msg,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout split={false}>
      <div className="auth-form-container animate-fade-in" style={{ maxWidth: '520px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <AuthBranding minimal />
        </div>

        <div className="auth-card">
          <div className="auth-card-header">
            <h1 className="auth-card-title">Create Patient Account</h1>
            <p className="auth-card-subtitle">
              Your healthcare, organized. Join MedNexus to consult doctors and manage records securely.
            </p>
          </div>

          <AuthError message={generalError} onDismiss={() => setGeneralError('')} />
          <AuthSuccess
            message={successMessage}
            onDismiss={() => setSuccessMessage('')}
            action={
              <Link to="/login" style={{ fontWeight: 600, color: 'var(--success-700)', textDecoration: 'underline' }}>
                Proceed to Sign In &rarr;
              </Link>
            }
          />

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <AuthInput
              id="patient-fullName"
              name="fullName"
              label="Full Name"
              placeholder="e.g. Sarah Jenkins"
              value={formData.fullName}
              onChange={handleChange}
              icon={User}
              error={errors.fullName}
              autoComplete="name"
              required
            />

            <AuthInput
              id="patient-email"
              name="email"
              type="email"
              label="Email Address"
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
              icon={Mail}
              error={errors.email}
              autoComplete="email"
              required
            />

            <AuthInput
              id="patient-phoneNumber"
              name="phoneNumber"
              type="tel"
              label="Phone Number"
              placeholder="+1 (555) 019-2834"
              value={formData.phoneNumber}
              onChange={handleChange}
              icon={Phone}
              error={errors.phoneNumber}
              autoComplete="tel"
              required
            />

            <PasswordInput
              id="patient-password"
              name="password"
              label="Password"
              placeholder="At least 8 characters"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              autoComplete="new-password"
              required
            />

            {formData.password && <PasswordStrength password={formData.password} />}

            <PasswordInput
              id="patient-confirmPassword"
              name="confirmPassword"
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              autoComplete="new-password"
              required
            />

            <AuthButton
              type="submit"
              loading={loading}
              loadingText="Creating Patient Account..."
              icon={ArrowRight}
            >
              Create Patient Account
            </AuthButton>
          </form>

          <div className="auth-card-footer">
            <span>Already have an account?</span>
            <Link to="/login">Sign in</Link>
          </div>

          <TrustIndicators />
        </div>
      </div>
    </AuthLayout>
  );
}

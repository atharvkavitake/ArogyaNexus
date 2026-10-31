import React, { Suspense, lazy, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterSelectPage from './pages/RegisterSelectPage';
import PatientRegisterPage from './pages/PatientRegisterPage';
import DoctorRegisterPage from './pages/DoctorRegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import { DoctorDiscoveryPage, PublicDoctorProfilePage, PublicHomePage } from './pages/PublicPages';
import Toast from './components/auth/Toast';
import AppErrorBoundary from './components/ui/AppErrorBoundary';
import NotFound from './pages/NotFound';
import { ActiveProfileProvider } from './contexts/ActiveProfileContext';

const PatientDashboard = lazy(() => import('./pages/patient/Dashboard'));
const DoctorDirectory = lazy(() => import('./pages/patient/DoctorDirectory'));
const DoctorProfile = lazy(() => import('./pages/patient/DoctorProfile'));
const BookAppointment = lazy(() => import('./pages/patient/BookAppointment'));
const PatientAppointments = lazy(() => import('./pages/patient/Appointments'));
const AppointmentCallPlaceholder = lazy(() => import('./pages/patient/AppointmentCallPlaceholder'));
const PatientRecords = lazy(() => import('./pages/patient/Records'));
const FamilyPage = lazy(() => import('./pages/patient/Family'));
const SettingsPage = lazy(() => import('./pages/patient/Settings'));
const ConsentPage = lazy(() => import('./pages/patient/Consent'));
const MedicinesPage = lazy(() => import('./pages/patient/Medicines'));
const DocumentsPage = lazy(() => import('./pages/patient/Documents'));
const CampsPage = lazy(() => import('./pages/patient/Camps'));
const PatientMessages = lazy(() => import('./pages/patient/Messages'));

const DoctorAppointments = lazy(() => import('./pages/doctor/Appointments'));
const DoctorSettings = lazy(() => import('./pages/doctor/Settings'));
const DoctorConsultationPlaceholder = lazy(() => import('./pages/doctor/Placeholders').then((module) => ({ default: module.ConsultationPlaceholder })));
const DoctorRecordsPlaceholder = lazy(() => import('./pages/doctor/PatientRecords'));
const DoctorMessages = lazy(() => import('./pages/doctor/Messages'));

import './styles/auth.css';
import './styles/app-errors.css';

export default function App() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ title, message, type = 'info', duration = 4500 }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    const newToast = { id, title, message, type };

    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <BrowserRouter>
      <AppErrorBoundary>
        {/* Toast Notification Container */}
        <Toast toasts={toasts} onRemove={removeToast} />

        <Suspense fallback={<div className="patient-route-loading" role="status">Loading page…</div>}>
          <Routes>
            <Route path="/" element={<PublicHomePage />} />
            <Route path="/doctors" element={<DoctorDiscoveryPage />} />
            <Route path="/doctors/:doctorId" element={<PublicDoctorProfilePage />} />
            <Route path="/login" element={<LoginPage onToast={addToast} />} />
            <Route path="/register" element={<RegisterSelectPage onToast={addToast} />} />
            <Route path="/register/patient" element={<PatientRegisterPage onToast={addToast} />} />
            <Route path="/register/doctor" element={<DoctorRegisterPage onToast={addToast} />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage onToast={addToast} />} />
            <Route path="/reset-password" element={<ResetPasswordPage onToast={addToast} />} />
            <Route path="/patient/*" element={<PatientProtectedRoute />} />
            <Route path="/doctor/dashboard" element={<DashboardPage role="doctor" />} />
            <Route path="/doctor/appointments" element={<DoctorAppointments />} />
            <Route path="/doctor/consult/:appointmentId" element={<DoctorConsultationPlaceholder />} />
            <Route path="/doctor/records/:patientId" element={<DoctorRecordsPlaceholder />} />
            <Route path="/doctor/records" element={<DoctorRecordsPlaceholder />} />
            <Route path="/doctor/messages" element={<DoctorMessages />} />
            <Route path="/doctor/chat" element={<DoctorMessages />} />
            <Route path="/doctor/settings" element={<DoctorSettings onToast={addToast} />} />
            <Route path="/doctor/:section" element={<DoctorAppointments comingSoon />} />
            <Route path="/admin/dashboard" element={<DashboardPage role="admin" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AppErrorBoundary>
    </BrowserRouter>
  );
}

function PatientProtectedRoute() {
  const fakeUser = { id: 'demo-patient', full_name: 'Rahul K.', role: 'patient' };
  if (fakeUser.role !== 'patient') return <Navigate to="/login" replace />;
  return (
    <ActiveProfileProvider>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<PatientDashboard user={fakeUser} />} />
        <Route path="doctors" element={<DoctorDirectory />} />
        <Route path="doctors/:doctorId" element={<DoctorProfile />} />
        <Route path="book-appointment/:doctorId" element={<BookAppointment />} />
        <Route path="appointments" element={<PatientAppointments />} />
        <Route path="records" element={<PatientRecords />} />
        <Route path="family" element={<FamilyPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="consent" element={<ConsentPage />} />
        <Route path="medicines" element={<MedicinesPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="camps" element={<CampsPage />} />
        <Route path="messages" element={<PatientMessages />} />
        <Route path="chat" element={<PatientMessages />} />
        <Route path="book/:doctorId" element={<BookAppointment />} />
        <Route path="appointments/:id/call" element={<AppointmentCallPlaceholder />} />
        <Route path="*" element={<NotFound patient />} />
      </Routes>
    </ActiveProfileProvider>
  );
}

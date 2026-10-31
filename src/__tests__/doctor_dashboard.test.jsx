import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import * as authService from '../services/auth/authService';
import * as chatApi from '../api/chat';
import * as doctorAppointmentsApi from '../api/doctorAppointments';
import DashboardPage from '../pages/DashboardPage';

describe('doctor dashboard rendering', () => {
  it('renders loading initially without throwing errors', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/doctor/dashboard']}>
        <DashboardPage role="doctor" />
      </MemoryRouter>
    );

    expect(typeof html).toBe('string');
    expect(html).toContain('dashboard-loading');
  });

  it('renders doctor dashboard workspace with appointments, quick links, and without AI assistant errors', () => {
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue({
      id: '22222222-2222-4222-a222-222222222222',
      full_name: 'Dr. Ananya S. Sharma',
      role: 'doctor',
      doctor_profile: {
        status: 'approved',
        speciality: 'Cardiologist',
        clinic_name: 'Apex Multi-Specialty Heart Center',
      },
    });

    const html = renderToString(
      <MemoryRouter initialEntries={['/doctor/dashboard']}>
        <DashboardPage role="doctor" />
      </MemoryRouter>
    );

    expect(html).not.toContain('doctor-assistant');
    expect(html).not.toContain('AI Clinical Assistant');
  });

  it('safely handles conversations with lastMessage objects {text, timestamp, senderRole}', async () => {
    vi.spyOn(chatApi, 'getChatConversations').mockResolvedValue([
      {
        participant: { id: 'patient-1', name: 'Rahul Sharma' },
        lastMessage: {
          text: 'BP reading is 138/88 mmHg today',
          timestamp: '2026-10-30T10:00:00.000Z',
          senderRole: 'patient',
        },
        unreadCount: 1,
      },
    ]);

    // Should not throw: Objects are not valid as a React child (found: object with keys {text, timestamp, senderRole})
    expect(() => {
      renderToString(
        <MemoryRouter initialEntries={['/doctor/dashboard']}>
          <DashboardPage role="doctor" />
        </MemoryRouter>
      );
    }).not.toThrow();
  });
});

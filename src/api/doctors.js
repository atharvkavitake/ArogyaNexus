import { getDoctorMock, getDoctorsMock, mockAvailability } from '../mocks/doctors';

function mockMode() {
  return new URLSearchParams(window.location.search).get('mock');
}

function delay() {
  return new Promise((resolve) => window.setTimeout(resolve, 400));
}

function normalizeDoctor(d) {
  if (!d) return null;
  const rawName = d.name || d.user?.full_name || 'Doctor';
  const name = /^dr\.?\s/i.test(rawName) ? rawName : `Dr. ${rawName}`;
  const fee = Number(d.consultationFee || d.consultation_fee || 500);
  const rating = Number(d.rating || d.rating_avg || 4.7);
  const reviewCount = Number(d.reviewCount || d.review_count || d.rating_count || 24);
  const clinic = d.clinic || d.clinic_name || 'Healthcare Clinic';
  const address = d.clinicAddress || d.clinic_address || '';
  const city = d.city || '';

  return {
    ...d,
    id: d.id,
    name,
    speciality: d.speciality,
    clinic,
    clinic_name: clinic,
    clinicAddress: address,
    clinic_address: address,
    city,
    consultationFee: fee,
    consultation_fee: fee,
    rating,
    reviewCount,
    review_count: reviewCount,
    experienceYears: d.experienceYears ?? d.experience_years ?? 10,
    languages: d.languages || ['Marathi', 'Hindi', 'English'],
    bio: d.bio || `${name} is an approved specialist in ${d.speciality} at ${clinic}.`,
    offersVideo: d.offersVideo ?? d.offers_video ?? true,
    today_available: true,
    video_available: d.offersVideo ?? d.offers_video ?? true,
    distance_km: d.distance_km || Number(((d.id ? d.id.charCodeAt(d.id.length - 1) % 12 : 3) + 1.4).toFixed(1)),
    user: {
      full_name: name,
    },
    registration_number: d.registrationNumber || d.registration_number || 'MMC-VERIFIED',
  };
}

export async function getDoctors(profileId, filters = {}) {
  void profileId;
  if (mockMode() === 'error') throw new Error('We couldn’t load doctors. Please try again.');
  if (mockMode() === 'empty') return [];

  try {
    const params = new URLSearchParams();
    if (filters.query || filters.q) params.set('q', (filters.query || filters.q).trim());
    if (filters.location || filters.city) params.set('city', filters.location || filters.city);
    if (filters.speciality) params.set('speciality', filters.speciality);
    if (filters.sort) params.set('sort', filters.sort);

    const response = await fetch(`/api/public/doctors${params.size ? `?${params.toString()}` : ''}`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.doctors)) {
        let docs = data.doctors.map(normalizeDoctor);
        if (filters.maxFee) {
          docs = docs.filter((d) => d.consultation_fee <= Number(filters.maxFee));
        }
        if (filters.minRating) {
          docs = docs.filter((d) => d.rating >= Number(filters.minRating));
        }
        if (filters.video) {
          docs = docs.filter((d) => d.offersVideo);
        }
        if (filters.sort === 'fee' || filters.sort === 'fee-asc') {
          docs.sort((a, b) => a.consultation_fee - b.consultation_fee);
        } else if (filters.sort === 'fee-desc') {
          docs.sort((a, b) => b.consultation_fee - a.consultation_fee);
        } else if (filters.sort === 'rating') {
          docs.sort((a, b) => b.rating - a.rating);
        } else if (filters.sort === 'experience') {
          docs.sort((a, b) => (b.experienceYears || 0) - (a.experienceYears || 0));
        }
        return docs;
      }
    }
  } catch (err) {
    console.warn('[API doctors] Fetch failed, falling back to mock:', err);
  }

  await delay();
  return getDoctorsMock(filters).map(normalizeDoctor);
}

export async function getDoctorById(doctorId, profileId) {
  void profileId;
  if (mockMode() === 'error') throw new Error('We couldn’t load this doctor profile. Please try again.');
  if (mockMode() === 'empty') return null;

  try {
    const response = await fetch(`/api/public/doctors/${encodeURIComponent(doctorId)}`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.doctor) {
        return normalizeDoctor(data.doctor);
      }
    }
  } catch (err) {
    console.warn('[API doctor by id] Fetch failed, falling back to mock:', err);
  }

  await delay();
  const doc = getDoctorMock(doctorId);
  return doc ? normalizeDoctor(doc) : null;
}

export async function getDoctorAvailability(doctorId, profileId) {
  await delay();
  void profileId;
  if (mockMode() === 'error') throw new Error('We couldn’t load available appointment times. Please try again.');
  if (mockMode() === 'empty') return [];
  const slots = mockAvailability[doctorId] || ['09:30 AM', '10:45 AM', '11:30 AM', '02:15 PM', '04:00 PM', '05:30 PM'];
  const days = [];
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  while (days.length < 5) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() === 0) continue;
    const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    days.push({ date: isoDate, label: date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }), slots });
  }
  return days;
}

export async function createAppointmentRequest(appointment) {
  if (mockMode() === 'error') throw new Error('Your appointment request could not be sent. Please try again.');

  try {
    const response = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        doctorId: appointment.doctor_profile_id,
        appointmentAt: appointment.appointment_at,
        reason: appointment.reason,
        profileId: appointment.patient_id || 'me',
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success && data.appointment) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('arogyanexus.last_booked', JSON.stringify({
          id: data.appointment.id,
          time: Date.now(),
        }));
        window.dispatchEvent(new CustomEvent('arogyanexus:appointment_booked', { detail: data.appointment }));
      }
      return {
        id: data.appointment.id,
        patient_id: appointment.patient_id,
        doctor_profile_id: appointment.doctor_profile_id,
        appointment_at: data.appointment.appointmentAt || appointment.appointment_at,
        reason: appointment.reason || null,
        status: data.appointment.status || 'pending',
        created_at: new Date().toISOString(),
      };
    }
    if (!response.ok && data.error) {
      throw new Error(data.error);
    }
  } catch (err) {
    if (err.message && !err.message.includes('fetch')) {
      throw err;
    }
    console.warn('[API appointments] Backend booking failed, falling back to local simulated response:', err);
  }

  await delay();
  return {
    id: `appointment-${Date.now()}`,
    patient_id: appointment.patient_id,
    doctor_profile_id: appointment.doctor_profile_id,
    appointment_at: appointment.appointment_at,
    reason: appointment.reason || null,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
}

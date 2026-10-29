const doctors = [
  {
    id: 'dp-ananya-sharma', user_id: 'doctor-user-1', speciality: 'Cardiology', registration_number: 'MCI-2018-04192',
    clinic_name: 'Apex Heart & Wellness Centre', clinic_address: 'Indiranagar, Bengaluru, Karnataka', consultation_fee: 900,
    status: 'approved', created_at: '2024-02-10T09:00:00.000Z', updated_at: '2026-09-14T08:30:00.000Z',
    user: { id: 'doctor-user-1', full_name: 'Dr. Ananya Sharma' },
  },
  {
    id: 'dp-meera-iyer', user_id: 'doctor-user-2', speciality: 'Endocrinology', registration_number: 'KMC-2012-02573',
    clinic_name: 'Narayana Health City', clinic_address: 'Hosur Road, Bengaluru, Karnataka', consultation_fee: 1100,
    status: 'approved', created_at: '2023-08-17T09:00:00.000Z', updated_at: '2026-09-11T08:30:00.000Z',
    user: { id: 'doctor-user-2', full_name: 'Dr. Meera Iyer' },
  },
  {
    id: 'dp-arjun-nair', user_id: 'doctor-user-3', speciality: 'Dermatology', registration_number: 'KMC-2016-01884',
    clinic_name: 'Sparsh Skin & Laser Clinic', clinic_address: 'Jayanagar, Bengaluru, Karnataka', consultation_fee: 750,
    status: 'approved', created_at: '2024-04-02T09:00:00.000Z', updated_at: '2026-09-09T08:30:00.000Z',
    user: { id: 'doctor-user-3', full_name: 'Dr. Arjun Nair' },
  },
  {
    id: 'dp-ritu-rao', user_id: 'doctor-user-4', speciality: 'Paediatrics', registration_number: 'KMC-2019-05108',
    clinic_name: 'Cloudnine Children’s Clinic', clinic_address: 'Koramangala, Bengaluru, Karnataka', consultation_fee: 800,
    status: 'approved', created_at: '2024-01-29T09:00:00.000Z', updated_at: '2026-09-02T08:30:00.000Z',
    user: { id: 'doctor-user-4', full_name: 'Dr. Ritu Rao' },
  },
  {
    id: 'dp-vikram-patil', user_id: 'doctor-user-5', speciality: 'General Medicine', registration_number: 'MMC-2014-08219',
    clinic_name: 'Arogya Family Health Clinic', clinic_address: 'FC Road, Shivajinagar, Pune, Maharashtra', consultation_fee: 450,
    status: 'approved', created_at: '2024-03-15T09:00:00.000Z', updated_at: '2026-09-10T08:30:00.000Z',
    user: { id: 'doctor-user-5', full_name: 'Dr. Vikram Patil' },
  },
  {
    id: 'dp-sunita-kulkarni', user_id: 'doctor-user-6', speciality: 'Neurology', registration_number: 'KMC-2010-09341',
    clinic_name: 'Brain & Spine Specialty Center', clinic_address: 'MG Road, Bengaluru, Karnataka', consultation_fee: 1400,
    status: 'approved', created_at: '2022-11-20T09:00:00.000Z', updated_at: '2026-09-12T08:30:00.000Z',
    user: { id: 'doctor-user-6', full_name: 'Dr. Sunita Kulkarni' },
  },
  {
    id: 'dp-rajesh-deshmukh', user_id: 'doctor-user-7', speciality: 'Orthopaedics', registration_number: 'MMC-2015-03712',
    clinic_name: 'Joint Care & Bone Hospital', clinic_address: 'Baner Road, Pune, Maharashtra', consultation_fee: 650,
    status: 'approved', created_at: '2023-06-18T09:00:00.000Z', updated_at: '2026-09-08T08:30:00.000Z',
    user: { id: 'doctor-user-7', full_name: 'Dr. Rajesh Deshmukh' },
  },
  {
    id: 'dp-priya-nambiar', user_id: 'doctor-user-8', speciality: 'Ophthalmology', registration_number: 'KMC-2021-06782',
    clinic_name: 'Nethra Super Specialty Eye Care', clinic_address: 'Whitefield Main Road, Bengaluru, Karnataka', consultation_fee: 500,
    status: 'approved', created_at: '2024-05-12T09:00:00.000Z', updated_at: '2026-09-05T08:30:00.000Z',
    user: { id: 'doctor-user-8', full_name: 'Dr. Priya Nambiar' },
  },
  {
    id: 'dp-farhan-siddiqui', user_id: 'doctor-user-9', speciality: 'ENT', registration_number: 'KMC-2017-02451',
    clinic_name: 'Bangalore ENT & Hearing Care', clinic_address: 'Malleshwaram 8th Cross, Bengaluru, Karnataka', consultation_fee: 600,
    status: 'approved', created_at: '2023-09-24T09:00:00.000Z', updated_at: '2026-09-01T08:30:00.000Z',
    user: { id: 'doctor-user-9', full_name: 'Dr. Farhan Siddiqui' },
  },
  {
    id: 'dp-kavita-joshi', user_id: 'doctor-user-10', speciality: 'Psychiatry', registration_number: 'MMC-2013-04981',
    clinic_name: 'MindWell Wellness Center', clinic_address: 'Kothrud, Pune, Maharashtra', consultation_fee: 1200,
    status: 'approved', created_at: '2023-04-10T09:00:00.000Z', updated_at: '2026-09-15T08:30:00.000Z',
    user: { id: 'doctor-user-10', full_name: 'Dr. Kavita Joshi' },
  },
];

export const mockAvailability = {
  'dp-ananya-sharma': ['09:30 AM', '10:30 AM', '11:15 AM', '02:00 PM', '04:30 PM'],
  'dp-meera-iyer': ['10:00 AM', '11:30 AM', '01:15 PM', '03:00 PM'],
  'dp-arjun-nair': ['09:00 AM', '10:45 AM', '12:30 PM', '04:00 PM'],
  'dp-ritu-rao': ['09:15 AM', '11:00 AM', '01:30 PM', '03:45 PM'],
  'dp-vikram-patil': ['10:00 AM', '11:00 AM', '04:00 PM', '06:00 PM'],
  'dp-sunita-kulkarni': ['10:30 AM', '12:00 PM', '03:00 PM', '05:30 PM'],
  'dp-rajesh-deshmukh': ['09:00 AM', '11:30 AM', '02:30 PM', '04:30 PM'],
  'dp-priya-nambiar': ['09:30 AM', '11:00 AM', '01:00 PM', '03:30 PM'],
  'dp-farhan-siddiqui': ['10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM'],
  'dp-kavita-joshi': ['11:00 AM', '01:00 PM', '03:30 PM', '05:00 PM'],
};

const doctorMeta = [
  { rating: 4.9, review_count: 142, coords: [12.9784, 77.6408], today: true, video: true, distance: 1.8 },
  { rating: 4.8, review_count: 98,  coords: [12.8399, 77.6770], today: false, video: true, distance: 7.4 },
  { rating: 4.7, review_count: 76,  coords: [12.9250, 77.5938], today: true, video: false, distance: 3.2 },
  { rating: 4.9, review_count: 115, coords: [12.9352, 77.6245], today: true, video: true, distance: 2.5 },
  { rating: 4.6, review_count: 84,  coords: [18.5204, 73.8567], today: true, video: true, distance: 1.2 },
  { rating: 5.0, review_count: 210, coords: [12.9756, 77.6066], today: false, video: true, distance: 1.5 },
  { rating: 4.8, review_count: 132, coords: [18.5590, 73.7868], today: true, video: false, distance: 4.8 },
  { rating: 4.7, review_count: 63,  coords: [12.9698, 77.7499], today: true, video: true, distance: 8.6 },
  { rating: 4.5, review_count: 51,  coords: [13.0031, 77.5643], today: false, video: false, distance: 5.1 },
  { rating: 4.9, review_count: 167, coords: [18.5074, 73.8077], today: true, video: true, distance: 3.9 },
];

export function getDoctorsMock(filters = {}) {
  const query = (filters.query || '').trim().toLowerCase();
  const speciality = (filters.speciality || '').toLowerCase();
  const location = (filters.location || '').toLowerCase();
  const haversine = (lat1, lon1, lat2, lon2) => {
    const radians = (degrees) => (degrees * Math.PI) / 180;
    const dLat = radians(lat2 - lat1);
    const dLon = radians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const enriched = doctors
    .filter((doctor) => doctor.status === 'approved')
    .filter((doctor) => !speciality || doctor.speciality.toLowerCase() === speciality)
    .filter((doctor) => !location || doctor.clinic_address.toLowerCase().includes(location))
    .filter(
      (doctor) =>
        !query ||
        `${doctor.user.full_name} ${doctor.speciality} ${doctor.clinic_name} ${doctor.clinic_address}`
          .toLowerCase()
          .includes(query)
    )
    .map((doctor, index) => {
      const meta = doctorMeta[index] || { rating: 4.7, review_count: 50, coords: [12.9716, 77.5946], today: true, video: true, distance: 3.0 };
      return {
        ...doctor,
        rating: meta.rating,
        review_count: meta.review_count,
        video_available: meta.video,
        today_available: meta.today,
        coordinates: meta.coords,
        default_distance: meta.distance,
      };
    });

  const origin = filters.coordinates || (filters.location === 'bengaluru' ? [12.9716, 77.5946] : filters.location === 'pune' ? [18.5204, 73.8567] : null);

  return enriched
    .map((doctor) => ({
      ...doctor,
      distance_km: origin
        ? Number(haversine(origin[0], origin[1], ...doctor.coordinates).toFixed(1))
        : doctor.default_distance,
    }))
    .filter((doctor) => !filters.maxFee || doctor.consultation_fee <= Number(filters.maxFee))
    .filter((doctor) => !filters.minRating || doctor.rating >= Number(filters.minRating))
    .filter((doctor) => !filters.today || doctor.today_available)
    .filter((doctor) => !filters.video || doctor.video_available)
    .filter((doctor) => !filters.distance || doctor.distance_km <= Number(filters.distance))
    .sort((a, b) => {
      if (filters.sort === 'fee') return a.consultation_fee - b.consultation_fee; // Lowest fee first
      if (filters.sort === 'rating') return b.rating - a.rating; // Highest rating first
      if (filters.sort === 'distance') return a.distance_km - b.distance_km; // Nearest first
      return 0; // Recommended default
    });
}

export function getDoctorMock(doctorId) {
  return doctors.find((doctor) => doctor.id === doctorId && doctor.status === 'approved') || null;
}

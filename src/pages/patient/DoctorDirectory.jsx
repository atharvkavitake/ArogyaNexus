import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Languages,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  UserRound,
  Video,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import PatientLayout from '../../components/patient/PatientLayout';
import { Avatar, Button, Card } from '../../components/ui';
import { useActiveProfile } from '../../contexts/activeProfile';
import { getDoctors } from '../../api/doctors';
import '../../styles/public.css';
import '../../styles/patient-doctors.css';

const CITIES = ['Kolhapur', 'Sangli', 'Satara', 'Pune', 'Mumbai', 'Nashik', 'Solapur', 'Bengaluru'];

const SPECIALITIES = [
  'Cardiology',
  'Dermatology',
  'Orthopedics',
  'Pediatrics',
  'Neurology',
  'Gynecology',
  'General Medicine',
  'ENT',
  'Gastroenterology',
  'Pulmonology',
  'Endocrinology',
  'Psychiatry',
  'Nephrology',
  'Urology',
  'Oncology',
  'Rheumatology',
  'General Surgery',
  'Dental Surgery',
  'Physiotherapy',
  'Ophthalmology',
];

const PAGE_SIZE = 12;

export default function DoctorDirectory() {
  const { activeProfile } = useActiveProfile();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial states from URL parameters
  const initialCity = searchParams.get('city') || '';
  const initialQuery = searchParams.get('q') || '';
  const initialSpeciality = searchParams.get('speciality') || '';
  const initialSort = searchParams.get('sort') || 'verified';
  const initialVideo = searchParams.get('video') === 'true';

  const [city, setCity] = useState(initialCity);
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [speciality, setSpeciality] = useState(initialSpeciality);
  const [sort, setSort] = useState(initialSort);
  const [videoOnly, setVideoOnly] = useState(initialVideo);
  const [currentPage, setCurrentPage] = useState(1);

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Sync state when URL search params change externally (e.g. browser back/forward)
  useEffect(() => {
    const pCity = searchParams.get('city') || '';
    const pQuery = searchParams.get('q') || '';
    const pSpec = searchParams.get('speciality') || '';
    const pSort = searchParams.get('sort') || 'verified';
    const pVideo = searchParams.get('video') === 'true';

    setCity(pCity);
    setQueryInput(pQuery);
    setSubmittedQuery(pQuery);
    setSpeciality(pSpec);
    setSort(pSort);
    setVideoOnly(pVideo);
    setCurrentPage(1);
  }, [searchParams]);

  // Update URL search parameters when filters change
  const updateUrlParams = useCallback((newFilters) => {
    const next = new URLSearchParams();
    const targetCity = 'city' in newFilters ? newFilters.city : city;
    const targetQuery = 'q' in newFilters ? newFilters.q : submittedQuery;
    const targetSpec = 'speciality' in newFilters ? newFilters.speciality : speciality;
    const targetSort = 'sort' in newFilters ? newFilters.sort : sort;
    const targetVideo = 'video' in newFilters ? newFilters.video : videoOnly;

    if (targetCity) next.set('city', targetCity);
    if (targetQuery.trim()) next.set('q', targetQuery.trim());
    if (targetSpec) next.set('speciality', targetSpec);
    if (targetSort && targetSort !== 'verified') next.set('sort', targetSort);
    if (targetVideo) next.set('video', 'true');

    setSearchParams(next, { replace: true });
    setCurrentPage(1);
  }, [city, submittedQuery, speciality, sort, videoOnly, setSearchParams]);

  // Fetch doctors whenever filters change
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    const filterPayload = {
      q: submittedQuery.trim(),
      query: submittedQuery.trim(),
      city,
      location: city,
      speciality,
      sort,
      video: videoOnly,
    };

    getDoctors(activeProfile?.id, filterPayload)
      .then((data) => {
        if (active) {
          setDoctors(data || []);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Could not load doctors.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeProfile?.id, city, submittedQuery, speciality, sort, videoOnly, reloadKey]);

  // Pagination calculation
  const totalPages = Math.ceil(doctors.length / PAGE_SIZE) || 1;
  const paginatedDoctors = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return doctors.slice(start, start + PAGE_SIZE);
  }, [doctors, currentPage]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 320, behavior: 'smooth' });
  };

  // Handle Search Submission
  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setSubmittedQuery(queryInput);
    updateUrlParams({ q: queryInput });
  };

  // Handle City Selector
  const handleCityChange = (newCity) => {
    setCity(newCity);
    updateUrlParams({ city: newCity });
  };

  // Handle Speciality Pills
  const handleSpecialityClick = (selectedSpec) => {
    const nextSpec = speciality === selectedSpec ? '' : selectedSpec;
    setSpeciality(nextSpec);
    updateUrlParams({ speciality: nextSpec });
  };

  // Handle Sort Change
  const handleSortChange = (newSort) => {
    setSort(newSort);
    updateUrlParams({ sort: newSort });
  };

  // Handle Video Visits Toggle
  const handleVideoToggle = () => {
    const nextVideo = !videoOnly;
    setVideoOnly(nextVideo);
    updateUrlParams({ video: nextVideo });
  };

  // Handle Reset Filters
  const handleClearFilters = () => {
    setCity('');
    setQueryInput('');
    setSubmittedQuery('');
    setSpeciality('');
    setSort('verified');
    setVideoOnly(false);
    setCurrentPage(1);
    setSearchParams({}, { replace: true });
    setReloadKey((prev) => prev + 1);
  };

  return (
    <PatientLayout profile={activeProfile}>
      <main className="patient-content patient-directory-page">
        {/* Hero Search Section - identical to localhost public search banner */}
        <section className="directory-hero patient-directory-hero">
          <div className="directory-hero-content">
            <span className="public-section-kicker">
              <ShieldCheck size={14} /> YOUR CARE, YOUR WAY
            </span>
            <h1>Find a doctor you can trust</h1>
            <p>Search verified healthcare professionals by name, speciality, clinic, or city.</p>

            <form className="public-search-form directory-search-form" onSubmit={handleSearchSubmit}>
              <label className="public-city-select">
                <MapPin size={18} />
                <select
                  value={city}
                  onChange={(e) => handleCityChange(e.target.value)}
                  aria-label="Filter by city"
                >
                  <option value="">All cities</option>
                  {CITIES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} />
              </label>

              <label className="public-query-input">
                <Search size={18} />
                <input
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="Doctor, speciality, or clinic"
                  aria-label="Search doctors"
                />
              </label>

              <button type="submit">
                Search <ArrowRight size={16} />
              </button>
            </form>

            {/* Quick Maharashtra City Chips */}
            <div className="directory-city-chips">
              <span className="city-chip-label">Quick cities:</span>
              <button
                type="button"
                className={`city-chip ${!city ? 'active' : ''}`}
                onClick={() => handleCityChange('')}
              >
                All
              </button>
              {CITIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`city-chip ${city === c ? 'active' : ''}`}
                  onClick={() => handleCityChange(city === c ? '' : c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Horizontal Speciality Filters */}
        <div className="directory-speciality-filter">
          <button
            type="button"
            className={!speciality ? 'selected' : ''}
            onClick={() => handleSpecialityClick('')}
          >
            All specialities
          </button>
          {SPECIALITIES.map((spec) => (
            <button
              key={spec}
              type="button"
              className={speciality === spec ? 'selected' : ''}
              onClick={() => handleSpecialityClick(spec)}
            >
              {spec}
            </button>
          ))}
        </div>

        {/* Directory Results Heading & Sorting */}
        <div className="directory-heading">
          <div>
            <span className="public-section-kicker">APPROVED HEALTHCARE PROFESSIONALS</span>
            <h2>
              {speciality || 'All Specialists'}
              {city ? ` in ${city}` : ''}
            </h2>
            <p>
              {loading
                ? 'Searching verified doctors…'
                : doctors.length === 0
                ? '0 verified doctors found'
                : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, doctors.length)} of ${doctors.length} verified doctors`}
            </p>
          </div>

          <div className="directory-controls">
            <button
              type="button"
              className={`directory-video-toggle ${videoOnly ? 'active' : ''}`}
              onClick={handleVideoToggle}
              aria-pressed={videoOnly}
            >
              <Video size={14} /> Video visits only
            </button>

            <label className="directory-sort">
              Sorted by
              <select value={sort} onChange={(e) => handleSortChange(e.target.value)}>
                <option value="verified">Verified doctors</option>
                <option value="fee-asc">Lowest fee</option>
                <option value="fee-desc">Highest fee</option>
                <option value="rating">Highest rating</option>
                <option value="experience">Experience</option>
              </select>
            </label>
          </div>
        </div>

        {/* Results Body */}
        {error ? (
          <div className="patient-directory-empty">
            <RotateCcw size={28} />
            <b>Could not load doctors</b>
            <p>{error}</p>
            <button type="button" onClick={() => setReloadKey((v) => v + 1)}>
              Retry search
            </button>
          </div>
        ) : loading ? (
          <div className="public-doctor-grid">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="public-doctor-card skeleton-doctor-card">
                <div className="skeleton-line skeleton-avatar" />
                <div className="skeleton-line" style={{ width: '60%', height: '14px', margin: '8px 0' }} />
                <div className="skeleton-line" style={{ width: '40%', height: '10px', marginBottom: '14px' }} />
                <div className="skeleton-line" style={{ width: '90%', height: '11px', marginBottom: '8px' }} />
                <div className="skeleton-line" style={{ width: '50%', height: '14px', marginBottom: '12px' }} />
                <div className="skeleton-actions" />
              </div>
            ))}
          </div>
        ) : doctors.length > 0 ? (
          <>
            <div className="public-doctor-grid">
              {paginatedDoctors.map((doctor) => (
                <PatientDoctorCard key={doctor.id} doctor={doctor} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="directory-pagination">
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  Previous
                </button>
                <div className="pagination-pages">
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          className={`pagination-page ${currentPage === pageNum ? 'active' : ''}`}
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    if (pageNum === currentPage - 3 || pageNum === currentPage + 3) {
                      return (
                        <span key={pageNum} className="pagination-ellipsis">
                          …
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="patient-directory-empty">
            <Search size={28} />
            <b>No verified doctors found</b>
            <p>
              {speciality || city || submittedQuery
                ? 'No doctor matches your specific filters. Try expanding your search or selecting another city or speciality.'
                : 'Doctor profiles are currently being loaded. Please check back shortly.'}
            </p>
            {(speciality || city || submittedQuery) && (
              <button type="button" onClick={handleClearFilters}>
                Clear all filters
              </button>
            )}
          </div>
        )}
      </main>
    </PatientLayout>
  );
}

function PatientDoctorCard({ doctor }) {
  const initials = useMemo(() => {
    const raw = (doctor.name || '').replace(/^dr\.?\s+/i, '');
    const parts = raw.split(' ').filter(Boolean);
    if (!parts.length) return 'DR';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [doctor.name]);

  return (
    <article className="public-doctor-card patient-doctor-card">
      <div className="public-doctor-card-top">
        <span className="public-doctor-avatar">
          <Avatar name={doctor.name} initials={initials} size="md" />
        </span>
        <div className="public-doctor-name">
          <h3>{doctor.name}</h3>
          <p>
            {doctor.speciality}
            {doctor.experienceYears ? ` · ${doctor.experienceYears}+ yrs` : ''}
            {doctor.qualification ? ` · ${doctor.qualification}` : ''}
          </p>
        </div>
        <span className="public-rating">
          {doctor.rating ? (
            <>
              ★ {Number(doctor.rating).toFixed(1)}
              <small>{doctor.reviewCount || 20}+ reviews</small>
            </>
          ) : (
            <>
              New
              <small>No reviews yet</small>
            </>
          )}
        </span>
      </div>

      <div className="public-clinic">
        <b>Clinic: {doctor.clinic || doctor.clinic_name}</b>
        <span>
          <MapPin size={13} /> {doctor.city ? `${doctor.city} · ` : ''}
          {doctor.clinicAddress || doctor.clinic_address}
        </span>
      </div>

      <div className="public-fee">
        <span>Consultation fee</span>
        <b>₹{Number(doctor.consultationFee || doctor.consultation_fee).toLocaleString('en-IN')}</b>
      </div>

      <div className="public-availability">
        <span className="availability-pending">
          <Clock3 size={13} />{' '}
          {doctor.offersVideo ? 'Video visits available' : 'In-person visits'}
        </span>
        <span className="verified-tag">
          <BadgeCheck size={13} /> Verified doctor
        </span>
      </div>

      <div className="public-card-actions">
        <Link to={`/patient/doctors/${doctor.id}`} className="public-view-profile-btn">
          View Profile
        </Link>
        <Link
          to={`/patient/book-appointment/${doctor.id}`}
          className="public-book-slot-btn"
        >
          <CalendarDays size={14} /> Book Slot
        </Link>
      </div>
    </article>
  );
}

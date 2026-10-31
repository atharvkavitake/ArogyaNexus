import { Link, useParams } from 'react-router-dom';
import DoctorPatientRecords from './PatientRecords';
import '../../styles/dashboard.css';
import '../../styles/doctor-appointments.css';

export function ConsultationPlaceholder() {
  const { appointmentId } = useParams();
  return (
    <main className="doctor-coming-soon">
      <h1>Consultation</h1>
      <p>Consultation workspace for appointment {appointmentId} is coming soon.</p>
      <Link to="/doctor/appointments">Back to appointments</Link>
    </main>
  );
}

export function MedicalRecordsPlaceholder(props) {
  return <DoctorPatientRecords {...props} />;
}

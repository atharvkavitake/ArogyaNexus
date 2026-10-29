# Patient UI API contract

All IDs and timestamps are strings; dates are ISO 8601. Every function is profile scoped by `patientId` where relevant. API modules currently return mock data after 400 ms and support `?mock=empty` / `?mock=error`. Prisma names below are planned source tables; field names in UI objects should be retained by the backend.

## Platform API

| Endpoint | Response | Access |
|---|---|---|
| `GET /api/v1/health` | `{data:{status:"ok",database:"connected"}}` or `{code,message}` | Public liveness and database connectivity check |

| Page | API function and response | Query/input | Planned Prisma source |
|---|---|---|---|
| Dashboard | `getPatientDashboard(patientId)` → `{profile, nextAppointment, medicinesToday[], recentVisits[], camps[], documents[], consent}` | `patientId` | `Patient`, `Profile`, `Appointment`, `PrescriptionItem`, `DoseLog`, `Camp`, `HealthRecord`, `Consent` |
| Find Doctors | `getDoctors(filters)` → `{doctors: Doctor[], total:number}`; `getDoctor(id)` → `DoctorProfile`; `getDoctorSlots(id,date)` → `{slots:string[]}` | `q, specialty, distance, rating, fee, today, video, sort, page, lat, lng`; doctor ID/date | `Doctor`, `Specialty`, `Clinic`, `AvailabilityRule`, `Slot`, `Review` |
| Appointments | `getAppointments(patientId)` → `{upcoming:Appointment[], past:Appointment[]}`; create/update/cancel functions return `Appointment` | `patientId`, appointment ID and mutation fields | `Appointment`, `Doctor`, `Clinic`, `Slot` |
| Health Records | `getRecords(patientId, filters)` → `{records:Record[], total:number, hasMore:boolean}`; `getRecordVitals(patientId,range)` → `{[type]:{latest,points[]}}`; `getRecordConditions(patientId)` → `{conditions[],allergies[]}`; `getAccessHistory(patientId)` → `AccessLog[]` | category, q, from, to, page, pageSize, range | `HealthRecord`, `VitalReading`, `PatientCondition`, `Profile.allergies`, `AccessLog` |
| Medicines | `getMedicines(patientId)` → `{items:PrescriptionItem[],doseLogs:DoseLog[],reminders:Reminder[]}`; mutation functions return updated item/log/reminder | `patientId`, item ID, date, time, patch | `PrescriptionItem`, `DoseLog`, `Reminder` |
| Documents | `getDocuments(patientId)` → `{documents:Document[],storage:{usedBytes,limitBytes}}`; upload/rename/tag/delete return changed `Document` or `{deleted:true}` | q, type, sort, view; document metadata | `HealthRecord` |
| Consent & Access | `getConsentData(patientId)` → `{consents:Consent[],accessLogs:AccessLog[]}`; update returns `Consent`; log returns `AccessLog` | status/date/doctor filters are client-side; mutation fields | `Consent`, `AccessLog`, `Appointment`, `Doctor` |
| Camps | `getCamps(patientId)` → `{camps:Camp[],reminders:CampReminder[]}`; save returns `CampReminder`; delete returns `true` | patient ID; distance/date/specialty/free/search/sort client-side | `Camp`, `CampReminder` |
| Family | `getFamily(patientId)` → `{members:FamilyMember[]}`; CRUD returns changed member or `{deleted:true}` | profile ID and member patch | `Patient`, `Profile`, `ProfileAccess`, `Profile.allergies` |
| Settings | `getSettings(patientId)` → `{profile,notifications,privacy,sessions,twoFactor}`; save returns updated section | patient ID, section patch | `Patient`, `Notification`, `Consent`, `Session` |

## Camp object fields

`Camp` is `{id, organizerDoctorId, organizerName, organizerVerified, title, description, specialtyTags:string[], isFree, startsAt, endsAt, venueName, address, city, lat, lng, seatsTotal, seatsLeft, status, services:string[], whatToBring:string[]}`. `CampReminder` is `{campId, patientId, remindAt, offset}` where offset is `ONE_DAY`, `MORNING_OF`, or `TWO_HOURS`. Reminder delivery channel selection is UI-only mock preference in this prototype.

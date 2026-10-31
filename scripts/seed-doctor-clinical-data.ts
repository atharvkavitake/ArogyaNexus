import fs from 'node:fs';
import path from 'node:path';

function makeMedicalPdf(reportTitle: string, lines: string[]): Buffer {
  let stream = 'BT /F1 14 Tf 50 780 Td (ArogyaNexus Diagnostic & Clinical Report) Tj 0 -22 Td /F1 12 Tf\n';
  stream += `(${reportTitle.replace(/[()]/g, '')}) Tj 0 -24 Td /F1 10 Tf\n`;
  for (const line of lines) {
    const clean = line.replace(/[()]/g, '');
    stream += `(${clean}) Tj 0 -16 Td\n`;
  }
  stream += 'ET';

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}

async function seedClinicalData() {
  const recordsDir = path.resolve('.private-records');
  if (!fs.existsSync(recordsDir)) {
    fs.mkdirSync(recordsDir, { recursive: true });
  }

  // 1. Generate rich PDFs for each key
  const filesData: Record<string, { title: string; lines: string[] }> = {
    'b9050a01-8719-404a-b42a-b4396e2d5fb0.pdf': {
      title: 'Complete Blood Count (CBC) with Differential',
      lines: [
        'Patient Name: Atharv Kavitake | Age: 32 | Gender: Male | Date: 2026-10-24',
        'Laboratory: Apollo Diagnostics Central Lab, Pune',
        '--------------------------------------------------------------------------------',
        'Hemoglobin (Hb): 13.8 g/dL          [NORMAL]     (Ref: 13.0 - 17.0 g/dL)',
        'Total RBC Count: 4.85 mil/uL        [NORMAL]     (Ref: 4.5 - 5.5 mil/uL)',
        'Total Leucocyte Count: 11,400 /uL   [HIGH]       (Ref: 4,000 - 10,000 /uL)',
        'Neutrophils: 74 %                   [HIGH]       (Ref: 40 - 70 %)',
        'Lymphocytes: 21 %                   [NORMAL]     (Ref: 20 - 40 %)',
        'Eosinophils: 3 %                    [NORMAL]     (Ref: 1 - 6 %)',
        'Platelet Count: 245,000 /uL         [NORMAL]     (Ref: 150,000 - 450,000 /uL)',
        'ESR (Westergren): 24 mm/hr          [ELEVATED]   (Ref: 0 - 15 mm/hr)',
        '--------------------------------------------------------------------------------',
        'Impression: Mild leucocytosis with neutrophilia and elevated ESR.',
        'Clinical Suggestion: Reactive acute-phase inflammatory process or early bacterial focus.',
      ],
    },
    '3a18e147-740c-4089-9817-a6ca0e8a6a50.pdf': {
      title: 'Comprehensive Lipid Profile Panel',
      lines: [
        'Patient Name: Atharv Kavitake | Age: 32 | Gender: Male | Date: 2026-10-18',
        'Laboratory: Metropolis Healthcare Advanced Diagnostic Hub',
        '--------------------------------------------------------------------------------',
        'Serum Total Cholesterol: 238 mg/dL  [HIGH]       (Ref: < 200 mg/dL)',
        'Serum Triglycerides: 212 mg/dL      [HIGH]       (Ref: < 150 mg/dL)',
        'HDL Cholesterol: 38 mg/dL           [LOW]        (Ref: > 40 mg/dL)',
        'LDL Cholesterol: 158 mg/dL          [HIGH]       (Ref: < 100 mg/dL, Optimal < 70)',
        'VLDL Cholesterol: 42 mg/dL          [ELEVATED]   (Ref: 5 - 30 mg/dL)',
        'Cholesterol / HDL Ratio: 6.26       [HIGH RISK]  (Ref: 3.3 - 4.4)',
        '--------------------------------------------------------------------------------',
        'Impression: Combined dyslipidemia with elevated LDL and depressed cardioprotective HDL.',
        'Atherogenic Risk: High 10-year ASCVD risk. Recommend statin titration and lifestyle change.',
      ],
    },
    '60db012a-31c8-4918-85b1-ecbcea0e9358.pdf': {
      title: '12-Lead ECG & Echocardiography Report',
      lines: [
        'Patient Name: Atharv Kavitake | Age: 32 | Date: 2026-10-26',
        'Department: Fortis Hospital Cardiology & Non-Invasive Diagnostics',
        '--------------------------------------------------------------------------------',
        'Resting Heart Rate: 96 bpm (Sinus Tachycardia). PR Interval: 152 ms. QTc: 428 ms.',
        'Left Ventricular Ejection Fraction (LVEF): 58 % (Normal systolic function).',
        'Interventricular Septal Thickness (IVSd): 12.2 mm [Mild Concentric LV Hypertrophy].',
        'Left Ventricular Posterior Wall: 11.8 mm. Left Atrium: Mild dilatation (39 mm).',
        'Valvular Doppler: Trace mitral regurgitation. Normal tricuspid gradient.',
        '--------------------------------------------------------------------------------',
        'Impression: Concentric left ventricular remodeling secondary to chronic systemic hypertension.',
        'Recommendation: Optimize antihypertensive regimen to prevent progression of diastolic dysfunction.',
      ],
    },
    '5c27e540-dfe6-4457-8d2b-2a5fb78a5391.pdf': {
      title: 'Cardiology Prescription & Treatment Protocol',
      lines: [
        'Doctor: Dr. Ananya Sharma, MD (Cardiology) | Clinic: Apex Multi-Specialty Heart Center',
        'Patient Name: Atharv Kavitake | Date: 2026-10-22',
        '--------------------------------------------------------------------------------',
        '1. Tab. Atorvastatin 20 mg - 1 tablet orally once daily at bedtime.',
        '2. Tab. Telmisartan 40 mg - 1 tablet orally once daily in the morning.',
        '3. Tab. Metoprolol Tartrate 25 mg - 1 tablet orally once daily with breakfast.',
        '--------------------------------------------------------------------------------',
        'IMPORTANT DRUG ALLERGY WARNING: Known severe hypersensitivity to Penicillin and Sulfa.',
        'Contraindication: Do not prescribe co-trimoxazole, amoxicillin, or sulfonylureas.',
        'Diet Advice: Strict low-sodium (< 2g/day) and low-saturated fat cardiac diet.',
      ],
    },
    '1962a3ca-7d33-42d1-89b4-4712e0bdb5a9.pdf': {
      title: 'Thyroid Function Test (TSH, Free T3, Free T4)',
      lines: [
        'Patient Name: Atharv Kavitake | Age: 32 | Date: 2026-10-12',
        'Laboratory: Dr Lal PathLabs Clinical Biochemistry',
        '--------------------------------------------------------------------------------',
        'Ultrasensitive TSH: 6.82 uIU/mL     [ELEVATED]   (Ref: 0.45 - 4.50 uIU/mL)',
        'Free T4 (FT4): 0.94 ng/dL           [LOW-NORMAL] (Ref: 0.82 - 1.77 ng/dL)',
        'Free T3 (FT3): 2.58 pg/mL           [NORMAL]     (Ref: 2.00 - 4.40 pg/mL)',
        '--------------------------------------------------------------------------------',
        'Impression: Subclinical hypothyroidism with elevated thyroid stimulating hormone.',
        'Clinical Note: May contribute to secondary dyslipidemia and fatigue. Review in 8 weeks.',
      ],
    },
    'df2556cc-0b7c-4f32-999f-7524a12bd1e5.pdf': {
      title: 'Chest Radiograph (PA View) Report',
      lines: [
        'Patient Name: Atharv Kavitake | Age: 32 | Date: 2026-10-09',
        'Radiology: Aster CMI Hospital Imaging Services',
        '--------------------------------------------------------------------------------',
        'Technique: Standard erect posterior-anterior (PA) view of the thorax.',
        'Cardiac Silhouette: Upper limits of normal size. Cardiothoracic ratio = 0.50.',
        'Pulmonary Vasculature: Normal distribution, no evidence of pulmonary venous congestion.',
        'Lung Parenchyma: Both lung fields are clear. No active infiltrates, consolidation or nodules.',
        'Costophrenic & Cardiophrenic Angles: Clear and sharp bilaterally.',
        '--------------------------------------------------------------------------------',
        'Impression: No acute cardiopulmonary disease. Borderline cardiothoracic ratio.',
      ],
    },
    'cdaaf7a4-575b-41b2-a6c6-1a559193624f.pdf': {
      title: 'Annual Inpatient Health Assessment & Discharge Summary',
      lines: [
        'Patient Name: Atharv Kavitake | Admission Date: 2026-09-28 | Discharge Date: 2026-09-30',
        'Hospital: Manipal Super-Specialty Hospital, Pune',
        '--------------------------------------------------------------------------------',
        'Primary Diagnosis: Accelerated Systemic Hypertension & Palpitations.',
        'Secondary Diagnosis: Essential Dyslipidemia (Hypertriglyceridemia).',
        'Hospital Course: Patient admitted via triage for symptomatic BP elevation (168/104 mmHg).',
        'Treated with parenteral labetalol and oral ACEi/ARB titration. Discharged symptom-free.',
        'Discharge BP: 134/86 mmHg. Advised strict outpatient monitoring and follow-up with cardiologist.',
      ],
    },
    'c51012b2-0266-4f1c-8325-b94f4d2e95ea.pdf': {
      title: 'General Consultation Clinical Notes',
      lines: [
        'Patient Name: Atharv Kavitake | Date: 2026-09-25 | Provider: Narayana Health Clinic',
        '--------------------------------------------------------------------------------',
        'Chief Complaint: Work-related fatigue, episodic palpitations, nocturnal restlessness.',
        'Physical Exam: Pulse 96 regular, BP 152/96 mmHg right arm sitting. Chest: Clear.',
        'Family History: Paternal myocardial infarction at age 52; Maternal essential hypertension.',
        'Allergies: Penicillin (severe urticaria & facial edema), Sulfa drugs.',
        'Plan: Referral to Cardiology for comprehensive cardiac workup and 2D echo.',
      ],
    },
    '757e692b-bf16-44a1-a833-8c2c2416c29e.pdf': {
      title: 'Hypertension Treatment & Prescription - Sunita Kavitake',
      lines: [
        'Patient Name: Sunita Kavitake | Age: 54 | Gender: Female | Date: 2026-10-15',
        'Provider: Dr. Ananya Sharma Clinic, Pune',
        '--------------------------------------------------------------------------------',
        '1. Tab. Amlodipine 5 mg - 1 tablet once daily morning.',
        '2. Tab. Levothyroxine 50 mcg - 1 tablet empty stomach 30 mins before breakfast.',
        'Blood Pressure at visit: 138/88 mmHg. Pulse: 78 bpm regular.',
        'Allergies: Aspirin (epigastric distress/rash). Avoid NSAIDs and Aspirin formulations.',
      ],
    },
  };

  for (const [filename, fileMeta] of Object.entries(filesData)) {
    const filePath = path.join(recordsDir, filename);
    const buf = makeMedicalPdf(fileMeta.title, fileMeta.lines);
    fs.writeFileSync(filePath, buf);
  }
  console.log('Seeded 9 enriched clinical PDFs in .private-records');

  // 2. Read and update .local_db.json
  const localDbPath = path.resolve('.local_db.json');
  let db: any = {};
  if (fs.existsSync(localDbPath)) {
    db = JSON.parse(fs.readFileSync(localDbPath, 'utf-8'));
  }

  db.users ||= [];
  db.doctor_profiles ||= [];
  db.profiles ||= [];
  db.appointments ||= [];
  db.vital_readings = [];
  db.patient_conditions = [];
  db.health_records = [];
  db.access_logs = [];

  // Ensure Doctor user and profile
  const docUserId = '22222222-2222-4222-a222-222222222222';
  let docUser = db.users.find((u: any) => u.id === docUserId);
  if (!docUser) {
    docUser = {
      id: docUserId,
      full_name: 'Dr. Ananya S. Sharma',
      email: 'd@gmail.com',
      password_hash: '$2a$12$e80yVvJdI15/lI7V6WqJ9.5qU8kU0oR4O0Yn/H3Yy7C1B4E8kU6qG',
      phone: '+91 98220 99881',
      role: 'doctor',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.users.push(docUser);
  }

  let docProfile = db.doctor_profiles.find((d: any) => d.id === 'dp-approved-1');
  if (!docProfile) {
    docProfile = {
      id: 'dp-approved-1',
      user_id: docUserId,
      speciality: 'Cardiology',
      registration_number: 'MCI-2020-88491',
      clinic_name: 'Apex Multi-Specialty Heart Center',
      clinic_address: 'Suite 400, Medical Boulevard, Pune, Maharashtra 411001',
      consultation_fee: 150,
      status: 'approved',
      verified: true,
      experience_years: 12,
      languages: ['English', 'Hindi', 'Marathi'],
      bio: 'Experienced cardiologist specializing in cardiovascular wellness, lipidology, and preventive cardiology.',
      offers_video: true,
      rating_avg: 4.9,
      rating_count: 88,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.doctor_profiles.push(docProfile);
  }

  // Ensure Patient Profiles
  const patientUserId = '33333333-3333-4333-a333-333333333333';
  let selfProf = db.profiles.find((p: any) => p.id === 'profile-self-1');
  if (selfProf) {
    Object.assign(selfProf, {
      name: 'Atharv Kavitake',
      relation: 'SELF',
      allergies: ['Penicillin', 'Sulfa Drugs', 'Pollen'],
      dob: '1994-05-15T00:00:00.000Z',
      gender: 'Male',
      blood_group: 'O+',
      emergency_name: 'Sunita Kavitake',
      emergency_phone: '+91 98220 12345',
      emergency_relation: 'MOTHER',
      notes: 'Stage 2 Essential Hypertension and Mixed Dyslipidemia. Report of exertional chest heaviness and palpitations.',
    });
  } else {
    selfProf = {
      id: 'profile-self-1',
      user_id: patientUserId,
      name: 'Atharv Kavitake',
      relation: 'SELF',
      allergies: ['Penicillin', 'Sulfa Drugs', 'Pollen'],
      dob: '1994-05-15T00:00:00.000Z',
      gender: 'Male',
      blood_group: 'O+',
      emergency_name: 'Sunita Kavitake',
      emergency_phone: '+91 98220 12345',
      emergency_relation: 'MOTHER',
      notes: 'Stage 2 Essential Hypertension and Mixed Dyslipidemia. Report of exertional chest heaviness and palpitations.',
      created_at: new Date().toISOString(),
    };
    db.profiles.push(selfProf);
  }

  let motherProf = db.profiles.find((p: any) => p.id === 'profile-mother-1');
  if (motherProf) {
    Object.assign(motherProf, {
      name: 'Sunita Kavitake',
      relation: 'MOTHER',
      allergies: ['Aspirin', 'Ibuprofen'],
      dob: '1970-08-20T00:00:00.000Z',
      gender: 'Female',
      blood_group: 'B+',
      emergency_name: 'Atharv Kavitake',
      emergency_phone: '+91 98220 54321',
      emergency_relation: 'SON',
      notes: 'Primary hypertension and subclinical hypothyroidism. On Amlodipine 5mg and Levothyroxine 50mcg.',
    });
  } else {
    motherProf = {
      id: 'profile-mother-1',
      user_id: patientUserId,
      name: 'Sunita Kavitake',
      relation: 'MOTHER',
      allergies: ['Aspirin', 'Ibuprofen'],
      dob: '1970-08-20T00:00:00.000Z',
      gender: 'Female',
      blood_group: 'B+',
      emergency_name: 'Atharv Kavitake',
      emergency_phone: '+91 98220 54321',
      emergency_relation: 'SON',
      notes: 'Primary hypertension and subclinical hypothyroidism. On Amlodipine 5mg and Levothyroxine 50mcg.',
      created_at: new Date().toISOString(),
    };
    db.profiles.push(motherProf);
  }

  // 3. Populate Vitals for Atharv (profile-self-1)
  const now = Date.now();
  const vitalsData = [
    { type: 'BP_SYSTOLIC', value: 148, unit: 'mmHg', hoursAgo: 0.5 },
    { type: 'BP_DIASTOLIC', value: 94, unit: 'mmHg', hoursAgo: 0.5 },
    { type: 'BLOOD_SUGAR_FASTING', value: 142, unit: 'mg/dL', hoursAgo: 2 },
    { type: 'CHOLESTEROL_TOTAL', value: 238, unit: 'mg/dL', hoursAgo: 24 * 6 },
    { type: 'HEART_RATE', value: 98, unit: 'bpm', hoursAgo: 0.5 },
    { type: 'WEIGHT', value: 78.5, unit: 'kg', hoursAgo: 24 * 3 },

    // Past readings for trend analysis
    { type: 'BP_SYSTOLIC', value: 142, unit: 'mmHg', hoursAgo: 24 * 4 },
    { type: 'BP_DIASTOLIC', value: 90, unit: 'mmHg', hoursAgo: 24 * 4 },
    { type: 'BLOOD_SUGAR_FASTING', value: 136, unit: 'mg/dL', hoursAgo: 24 * 8 },
    { type: 'HEART_RATE', value: 92, unit: 'bpm', hoursAgo: 24 * 4 },
    { type: 'BP_SYSTOLIC', value: 154, unit: 'mmHg', hoursAgo: 24 * 14 },
    { type: 'BP_DIASTOLIC', value: 98, unit: 'mmHg', hoursAgo: 24 * 14 },
    { type: 'BLOOD_SUGAR_FASTING', value: 128, unit: 'mg/dL', hoursAgo: 24 * 20 },
    { type: 'CHOLESTEROL_TOTAL', value: 245, unit: 'mg/dL', hoursAgo: 24 * 30 },
  ];

  for (const v of vitalsData) {
    db.vital_readings.push({
      id: `vital-${Math.random().toString(36).slice(2, 10)}`,
      patient_id: 'profile-self-1',
      type: v.type,
      value: v.value,
      unit: v.unit,
      measured_at: new Date(now - v.hoursAgo * 3600000).toISOString(),
      source: 'SELF',
      created_at: new Date(now - v.hoursAgo * 3600000).toISOString(),
    });
  }

  // Vitals for Sunita (profile-mother-1)
  const motherVitals = [
    { type: 'BP_SYSTOLIC', value: 136, unit: 'mmHg', hoursAgo: 1 },
    { type: 'BP_DIASTOLIC', value: 88, unit: 'mmHg', hoursAgo: 1 },
    { type: 'BLOOD_SUGAR_FASTING', value: 112, unit: 'mg/dL', hoursAgo: 4 },
    { type: 'HEART_RATE', value: 76, unit: 'bpm', hoursAgo: 1 },
    { type: 'WEIGHT', value: 65, unit: 'kg', hoursAgo: 24 * 5 },
  ];
  for (const v of motherVitals) {
    db.vital_readings.push({
      id: `vital-${Math.random().toString(36).slice(2, 10)}`,
      patient_id: 'profile-mother-1',
      type: v.type,
      value: v.value,
      unit: v.unit,
      measured_at: new Date(now - v.hoursAgo * 3600000).toISOString(),
      source: 'SELF',
      created_at: new Date(now - v.hoursAgo * 3600000).toISOString(),
    });
  }

  // 4. Populate Patient Conditions
  db.patient_conditions.push(
    {
      id: 'cond-1',
      patient_id: 'profile-self-1',
      name: 'Stage 2 Essential Hypertension',
      status: 'ACTIVE',
      since: '2022-04-10T00:00:00.000Z',
      notes: 'On oral antihypertensives, sub-optimal pressure control.',
      created_at: new Date().toISOString(),
    },
    {
      id: 'cond-2',
      patient_id: 'profile-self-1',
      name: 'Mixed Hyperlipidemia',
      status: 'ACTIVE',
      since: '2023-08-15T00:00:00.000Z',
      notes: 'Elevated total cholesterol and triglycerides, low HDL.',
      created_at: new Date().toISOString(),
    },
    {
      id: 'cond-3',
      patient_id: 'profile-self-1',
      name: 'Impaired Fasting Glucose / Pre-Diabetes',
      status: 'ACTIVE',
      since: '2024-01-20T00:00:00.000Z',
      notes: 'Fasting blood glucose routinely > 126 mg/dL. HbA1c screening recommended.',
      created_at: new Date().toISOString(),
    },
    {
      id: 'cond-4',
      patient_id: 'profile-mother-1',
      name: 'Primary Hypertension',
      status: 'ACTIVE',
      since: '2019-03-01T00:00:00.000Z',
      notes: 'Managed on Amlodipine 5mg.',
      created_at: new Date().toISOString(),
    },
    {
      id: 'cond-5',
      patient_id: 'profile-mother-1',
      name: 'Hypothyroidism',
      status: 'ACTIVE',
      since: '2021-06-12T00:00:00.000Z',
      notes: 'On Levothyroxine 50 mcg OD.',
      created_at: new Date().toISOString(),
    }
  );

  // 5. Populate Health Records linked to the 9 PDF files
  const healthRecordsMeta = [
    {
      id: 'rec-cbc-1',
      patient_id: 'profile-self-1',
      category: 'LAB_REPORT',
      title: 'Complete Blood Count (CBC) with Differential',
      issuer: 'Apollo Diagnostics',
      record_date: new Date(now - 6 * 86400000).toISOString(),
      file_key: 'b9050a01-8719-404a-b42a-b4396e2d5fb0.pdf',
      file_name: 'complete-blood-count-cbc.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1420,
    },
    {
      id: 'rec-lipid-1',
      patient_id: 'profile-self-1',
      category: 'LAB_REPORT',
      title: 'Comprehensive Lipid Profile Panel',
      issuer: 'Metropolis Healthcare',
      record_date: new Date(now - 12 * 86400000).toISOString(),
      file_key: '3a18e147-740c-4089-9817-a6ca0e8a6a50.pdf',
      file_name: 'comprehensive-lipid-profile.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1580,
    },
    {
      id: 'rec-echo-1',
      patient_id: 'profile-self-1',
      category: 'IMAGING',
      title: '12-Lead ECG & Echocardiography Report',
      issuer: 'Fortis Heart Institute',
      record_date: new Date(now - 4 * 86400000).toISOString(),
      file_key: '60db012a-31c8-4918-85b1-ecbcea0e9358.pdf',
      file_name: 'echocardiogram-ecg-report.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1620,
    },
    {
      id: 'rec-rx-1',
      patient_id: 'profile-self-1',
      category: 'PRESCRIPTION',
      title: 'Cardiology Prescription & Treatment Protocol',
      issuer: 'Apex Multi-Specialty Heart Center',
      record_date: new Date(now - 8 * 86400000).toISOString(),
      file_key: '5c27e540-dfe6-4457-8d2b-2a5fb78a5391.pdf',
      file_name: 'cardiology-prescription-atorvastatin-20mg.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1490,
    },
    {
      id: 'rec-thyroid-1',
      patient_id: 'profile-self-1',
      category: 'LAB_REPORT',
      title: 'Thyroid Function Test (TSH, Free T3, Free T4)',
      issuer: 'Dr Lal PathLabs',
      record_date: new Date(now - 18 * 86400000).toISOString(),
      file_key: '1962a3ca-7d33-42d1-89b4-4712e0bdb5a9.pdf',
      file_name: 'thyroid-function-test.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1410,
    },
    {
      id: 'rec-xray-1',
      patient_id: 'profile-self-1',
      category: 'IMAGING',
      title: 'Chest Radiograph (PA View) Report',
      issuer: 'Aster CMI Hospital',
      record_date: new Date(now - 21 * 86400000).toISOString(),
      file_key: 'df2556cc-0b7c-4f32-999f-7524a12bd1e5.pdf',
      file_name: 'chest-x-ray-pa-view.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1480,
    },
    {
      id: 'rec-discharge-1',
      patient_id: 'profile-self-1',
      category: 'DISCHARGE_SUMMARY',
      title: 'Annual Inpatient Health Assessment & Discharge Summary',
      issuer: 'Manipal Hospital',
      record_date: new Date(now - 32 * 86400000).toISOString(),
      file_key: 'cdaaf7a4-575b-41b2-a6c6-1a559193624f.pdf',
      file_name: 'annual-health-assessment-summary.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1530,
    },
    {
      id: 'rec-notes-1',
      patient_id: 'profile-self-1',
      category: 'OTHER',
      title: 'General Consultation Clinical Notes',
      issuer: 'Narayana Health Clinic',
      record_date: new Date(now - 35 * 86400000).toISOString(),
      file_key: 'c51012b2-0266-4f1c-8325-b94f4d2e95ea.pdf',
      file_name: 'general-consultation-clinical-notes.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1390,
    },
    {
      id: 'rec-sunita-rx-1',
      patient_id: 'profile-mother-1',
      category: 'PRESCRIPTION',
      title: 'Hypertension Treatment & Prescription - Sunita Kavitake',
      issuer: 'Dr. Ananya Sharma Clinic',
      record_date: new Date(now - 15 * 86400000).toISOString(),
      file_key: '757e692b-bf16-44a1-a833-8c2c2416c29e.pdf',
      file_name: 'hypertension-prescription.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1400,
    },
  ];

  for (const r of healthRecordsMeta) {
    db.health_records.push({
      id: r.id,
      patient_id: r.patient_id,
      category: r.category,
      title: r.title,
      issuer: r.issuer,
      record_date: r.record_date,
      doctor_id: 'dp-approved-1',
      uploaded_by: patientUserId,
      source: 'PATIENT_UPLOAD',
      file_key: r.file_key,
      file_name: r.file_name,
      mime_type: r.mime_type,
      size_bytes: r.size_bytes,
      deleted_at: null,
      created_at: r.record_date,
    });
  }

  // 6. Populate Appointments for Today, Upcoming, and Requests
  // System time today: 2026-10-30
  const todayMorning = new Date();
  todayMorning.setHours(9, 30, 0, 0);

  const todayMid = new Date();
  todayMid.setHours(10, 30, 0, 0);

  const todayNoon = new Date();
  todayNoon.setHours(11, 30, 0, 0);

  const todayEarly = new Date();
  todayEarly.setHours(8, 30, 0, 0);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 3);
  nextWeek.setHours(14, 30, 0, 0);

  db.appointments = [
    {
      id: 'appt-today-atharv-1',
      token_number: 1,
      patient_id: patientUserId,
      profile_id: 'profile-self-1',
      doctor_profile_id: 'dp-approved-1',
      appointment_at: todayMorning.toISOString(),
      ends_at: new Date(todayMorning.getTime() + 30 * 60000).toISOString(),
      status: 'in_consultation',
      mode: 'IN_PERSON',
      reason: 'Severe chest discomfort radiating to left arm, elevated BP, and recurring palpitations.',
      notes: 'Initial checkup: Pulse elevated, ECG reviewed. Stage 2 HTN protocol active.',
      check_in_vitals: { bpSys: 148, bpDia: 94, pulse: 98, spo2: 97, temp: 98.4 },
      checked_in_at: new Date(todayMorning.getTime() - 15 * 60000).toISOString(),
      consent: { id: 'consent-appt-today-atharv-1', status: 'ACTIVE', expiresAt: new Date(Date.now() + 86400000).toISOString() },
      created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
    },
    {
      id: 'appt-today-sunita-2',
      token_number: 2,
      patient_id: patientUserId,
      profile_id: 'profile-mother-1',
      doctor_profile_id: 'dp-approved-1',
      appointment_at: todayMid.toISOString(),
      ends_at: new Date(todayMid.getTime() + 30 * 60000).toISOString(),
      status: 'waiting',
      mode: 'IN_PERSON',
      reason: 'Follow-up for uncontrolled morning hypertension and thyroid dose adjustment.',
      notes: 'Patient checked in at waiting lounge. Reports mild morning headaches.',
      check_in_vitals: { bpSys: 136, bpDia: 88, pulse: 76, spo2: 98, temp: 98.6 },
      checked_in_at: new Date(todayMid.getTime() - 25 * 60000).toISOString(),
      consent: { id: 'consent-appt-today-sunita-2', status: 'ACTIVE', expiresAt: new Date(Date.now() + 86400000).toISOString() },
      created_at: new Date(Date.now() - 36 * 3600000).toISOString(),
    },
    {
      id: 'appt-today-pooja-3',
      token_number: 3,
      patient_id: 'patient-dummy-2',
      profile_id: 'profile-dummy-patient-2',
      doctor_profile_id: 'dp-approved-1',
      appointment_at: todayNoon.toISOString(),
      ends_at: new Date(todayNoon.getTime() + 30 * 60000).toISOString(),
      status: 'confirmed',
      mode: 'VIDEO',
      reason: 'Routine post-angioplasty lipid profile review and dosage titration.',
      notes: 'Tele-consultation confirmed. Link sent to patient.',
      check_in_vitals: null,
      consent: { id: 'consent-appt-today-pooja-3', status: 'ACTIVE', expiresAt: new Date(Date.now() + 86400000).toISOString() },
      created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    },
    {
      id: 'appt-today-sachin-4',
      token_number: 4,
      patient_id: 'patient-dummy-1',
      profile_id: 'profile-dummy-patient-1',
      doctor_profile_id: 'dp-approved-1',
      appointment_at: todayEarly.toISOString(),
      ends_at: new Date(todayEarly.getTime() + 30 * 60000).toISOString(),
      status: 'completed',
      mode: 'IN_PERSON',
      reason: 'Routine ECG evaluation and post-procedure checkup.',
      notes: 'Blood pressure 124/80 mmHg. Maintain current medication. ECG showed normal sinus rhythm.',
      check_in_vitals: { bpSys: 124, bpDia: 80, pulse: 72, spo2: 99, temp: 98.2 },
      checked_in_at: new Date(todayEarly.getTime() - 20 * 60000).toISOString(),
      consent: { id: 'consent-appt-today-sachin-4', status: 'ACTIVE', expiresAt: new Date(Date.now() + 86400000).toISOString() },
      created_at: new Date(Date.now() - 72 * 3600000).toISOString(),
    },
    {
      id: 'appt-upcoming-rohan-5',
      token_number: 5,
      patient_id: 'patient-dummy-3',
      profile_id: 'profile-dummy-patient-3',
      doctor_profile_id: 'dp-approved-1',
      appointment_at: tomorrow.toISOString(),
      ends_at: new Date(tomorrow.getTime() + 30 * 60000).toISOString(),
      status: 'confirmed',
      mode: 'IN_PERSON',
      reason: 'Type 2 diabetes with atypical chest pain on climbing stairs.',
      notes: 'Advised fasting state for morning blood tests.',
      check_in_vitals: null,
      consent: { id: 'consent-appt-upcoming-rohan-5', status: 'ACTIVE', expiresAt: new Date(Date.now() + 86400000 * 2).toISOString() },
      created_at: new Date(Date.now() - 12 * 3600000).toISOString(),
    },
    {
      id: 'appt-upcoming-atharv-6',
      token_number: 6,
      patient_id: patientUserId,
      profile_id: 'profile-self-1',
      doctor_profile_id: 'dp-approved-1',
      appointment_at: nextWeek.toISOString(),
      ends_at: new Date(nextWeek.getTime() + 30 * 60000).toISOString(),
      status: 'confirmed',
      mode: 'IN_PERSON',
      reason: 'Cardiology follow-up and echo re-assessment after medical optimization.',
      notes: '',
      check_in_vitals: null,
      consent: { id: 'consent-appt-upcoming-atharv-6', status: 'ACTIVE', expiresAt: new Date(Date.now() + 86400000 * 4).toISOString() },
      created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
    },
    {
      id: 'appt-req-meera-7',
      token_number: 7,
      patient_id: 'patient-dummy-4',
      profile_id: 'profile-dummy-patient-4',
      doctor_profile_id: 'dp-approved-1',
      appointment_at: new Date(Date.now() + 50 * 3600000).toISOString(),
      ends_at: new Date(Date.now() + 50.5 * 3600000).toISOString(),
      status: 'pending',
      mode: 'IN_PERSON',
      reason: 'New patient referral for recurrent tachycardia and borderline blood sugar.',
      notes: '',
      check_in_vitals: null,
      consent: { id: 'consent-appt-req-meera-7', status: 'PENDING', expiresAt: null },
      created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    },
    {
      id: 'appt-req-nilesh-8',
      token_number: 8,
      patient_id: 'patient-dummy-5',
      profile_id: 'profile-dummy-patient-5',
      doctor_profile_id: 'dp-approved-1',
      appointment_at: new Date(Date.now() + 74 * 3600000).toISOString(),
      ends_at: new Date(Date.now() + 74.5 * 3600000).toISOString(),
      status: 'pending',
      mode: 'VIDEO',
      reason: 'Second opinion on abnormal stress test and echocardiogram findings.',
      notes: '',
      check_in_vitals: null,
      consent: { id: 'consent-appt-req-nilesh-8', status: 'PENDING', expiresAt: null },
      created_at: new Date(Date.now() - 1 * 3600000).toISOString(),
    },
  ];

  fs.writeFileSync(localDbPath, JSON.stringify(db, null, 2), 'utf-8');
  console.log('Seeded complete clinical database in .local_db.json successfully!');
}

seedClinicalData().catch(console.error);

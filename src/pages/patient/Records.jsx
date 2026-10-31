import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileImage, FileText, Heart, Plus, Search, ShieldAlert, Sparkles, Trash2, UploadCloud, X } from 'lucide-react';
import PatientLayout from '../../components/patient/PatientLayout';
import { Avatar, Button, Card, EmptyState, ErrorState, Skeleton, StatusChip, Modal, ConfirmDialog } from '../../components/ui';
import DocumentVerificationModal from '../../components/patient/DocumentVerificationModal';
import { useActiveProfile } from '../../contexts/activeProfile';
import { addVital, deleteRecord, deleteVital, getRecordConditions, getRecordVitals, getRecords, recordFileUrl, saveConditions, uploadRecord } from '../../api/records';
import { formatPatientDate } from '../../utils/dates';
import '../../styles/patient-records.css';

const TABS = [
  ['ALL', 'All Records'],
  ['LAB_REPORT', 'Lab Reports'],
  ['PRESCRIPTION', 'Prescriptions'],
  ['IMAGING', 'Imaging & Scans'],
  ['DISCHARGE_SUMMARY', 'Discharge Summaries'],
];

const VITALS = [
  { type: 'BLOOD_SUGAR_FASTING', title: 'Blood Sugar (Fasting)', unit: 'mg/dL', tone: 'green' },
  { type: 'BLOOD_PRESSURE', title: 'Blood Pressure', unit: 'mmHg', tone: 'teal' },
  { type: 'CHOLESTEROL_TOTAL', title: 'Cholesterol (Total)', unit: 'mg/dL', tone: 'blue' },
];

const displayDate = (value) => formatPatientDate(value);
const todayDate = () => new Date().toLocaleDateString('en-CA');

export default function Records() {
  const { activeProfile } = useActiveProfile();
  const [category, setCategory] = useState('ALL');
  const [range, setRange] = useState('30d');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pagination, setPagination] = useState({ profileId: activeProfile.id, page: 1 });
  const page = pagination.profileId === activeProfile.id ? pagination.page : 1;
  const setPage = (value) =>
    setPagination((previous) => ({
      profileId: activeProfile.id,
      page: typeof value === 'function' ? value(previous.profileId === activeProfile.id ? previous.page : 1) : value,
    }));

  const [reload, setReload] = useState(0);
  const [data, setData] = useState({
    status: 'loading',
    vitals: {},
    vitalsHistory: [],
    conditions: [],
    allergies: [],
    notes: '',
    records: [],
    total: 0,
    hasMore: false,
  });

  const [modal, setModal] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [previewRecord, setPreviewRecord] = useState(null);
  const [verificationRecord, setVerificationRecord] = useState(null);
  const [vitalType, setVitalType] = useState('BLOOD_SUGAR_FASTING');
  const [uploadFile, setUploadFile] = useState(null);

  const [conditionsDraft, setConditionsDraft] = useState([]);
  const [allergyDraft, setAllergyDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');

  const [uploadDraft, setUploadDraft] = useState({
    title: '',
    category: 'LAB_REPORT',
    issuer: '',
    recordDate: todayDate(),
    doctorName: '',
  });

  const [vitalDraft, setVitalDraft] = useState({
    value: '',
    systolic: '',
    diastolic: '',
    measuredAt: new Date().toISOString().slice(0, 16),
  });

  const retry = useCallback(() => setReload((value) => value + 1), []);
  const queryKey = `${activeProfile.id}:${category}:${search}:${from}:${to}:${page}:${range}:${reload}`;

  useEffect(() => {
    let current = true;
    Promise.all([
      getRecordVitals(activeProfile.id, range),
      getRecordConditions(activeProfile.id),
      getRecords(activeProfile.id, { category, q: search, from, to, page, pageSize: 8 }),
    ])
      .then(([vitalResult, conditionResult, result]) => {
        if (current) {
          setData((old) => ({
            status: 'ready',
            loadedKey: queryKey,
            vitals: vitalResult.vitals || {},
            vitalsHistory: vitalResult.history || [],
            conditions: conditionResult.conditions || [],
            allergies: conditionResult.allergies || [],
            notes: conditionResult.notes || '',
            records:
              page > 1 && old.loadedKey?.startsWith(`${activeProfile.id}:${category}:${search}:${from}:${to}:`)
                ? [...old.records, ...result.records]
                : result.records,
            total: result.total,
            hasMore: result.hasMore,
          }));
        }
      })
      .catch((failure) => {
        if (current) {
          setData((old) => ({ ...old, status: 'error', loadedKey: queryKey }));
          setError(failure.message);
        }
      });
    return () => {
      current = false;
    };
  }, [queryKey, activeProfile.id, category, search, from, to, page, range]);

  const startLoading = data.status === 'loading' || data.loadedKey !== queryKey;
  const records = useMemo(() => data.records, [data.records]);

  const openUpload = () => {
    setError('');
    setUploadFile(null);
    setUploadDraft({
      title: '',
      category: category === 'ALL' ? 'LAB_REPORT' : category,
      issuer: '',
      recordDate: todayDate(),
      doctorName: '',
    });
    setModal('upload');
  };

  const submitUpload = async (event) => {
    event.preventDefault();
    if (!uploadFile) {
      setError('Choose a PDF, JPG, or PNG file.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const uploadRes = await uploadRecord(activeProfile.id, uploadDraft, uploadFile);
      setModal('');
      const rec = uploadRes?.record;
      if (rec?.verificationStatus === 'AI_VERIFIED') {
        setNotice('Document uploaded and AI-verified successfully!');
      } else if (rec?.verificationStatus === 'DOCTOR_REVIEW_REQUIRED') {
        setNotice('Document uploaded. AI flagged for doctor review — you can select an attending doctor to request review.');
      } else {
        setNotice('Health record uploaded to database.');
      }
      setPage(1);
      retry();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const submitVital = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const body =
      vitalType === 'BLOOD_PRESSURE'
        ? {
            type: 'BP_SYSTOLIC',
            systolic: Number(vitalDraft.systolic),
            diastolic: Number(vitalDraft.diastolic),
            measuredAt: new Date(vitalDraft.measuredAt).toISOString(),
          }
        : {
            type: vitalType,
            value: Number(vitalDraft.value),
            measuredAt: new Date(vitalDraft.measuredAt).toISOString(),
          };
    try {
      await addVital(activeProfile.id, body);
      setModal('');
      setNotice('Vital reading saved directly to database.');
      setVitalDraft({ value: '', systolic: '', diastolic: '', measuredAt: new Date().toISOString().slice(0, 16) });
      retry();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const removeVital = async (id) => {
    setBusy(true);
    try {
      await deleteVital(id, activeProfile.id);
      setNotice('Vital reading removed.');
      retry();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const beginConditionsEdit = () => {
    setConditionsDraft(
      data.conditions.map((item) => ({
        name: item.name,
        status: item.status,
        since: item.since ? todayDateValue(item.since) : '',
        notes: item.notes || '',
      }))
    );
    setAllergyDraft(data.allergies.join(', '));
    setNotesDraft(data.notes || '');
    setError('');
    setModal('conditions');
  };

  const submitConditions = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await saveConditions(
        activeProfile.id,
        conditionsDraft.filter((item) => item.name.trim()),
        allergyDraft
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        notesDraft.trim()
      );
      setModal('');
      setNotice('Chronic conditions, allergies, and health notes saved.');
      retry();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const removeRecord = async () => {
    if (!recordToDelete) return;
    setBusy(true);
    try {
      await deleteRecord(recordToDelete.id, activeProfile.id);
      setRecordToDelete(null);
      setNotice('Record removed.');
      retry();
    } catch (failure) {
      setError(failure.message);
      setRecordToDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const loadMore = () => setPage((value) => value + 1);

  return (
    <PatientLayout profile={activeProfile}>
      <main className="patient-content patient-records-page">
        {activeProfile.id !== 'me' && (
          <div className={`active-profile-banner ${activeProfile.color}`}>
            <ShieldAlert size={17} />
            <span>
              Viewing <strong>{activeProfile.name}’s</strong> health profile · Only you can manage this profile
            </span>
          </div>
        )}

        <header className="records-toolbar">
          <div className="records-tabs" role="tablist" aria-label="Health record category">
            {TABS.map(([key, label]) => (
              <button
                type="button"
                role="tab"
                aria-selected={category === key}
                className={category === key ? 'selected' : ''}
                key={key}
                onClick={() => {
                  setCategory(key);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <Button type="button" onClick={openUpload}>
            <Plus size={16} /> Upload New Record (PDF)
          </Button>
        </header>

        {notice && (
          <div className="records-notice" role="status">
            {notice}
            <button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}>
              <X size={15} />
            </button>
          </div>
        )}

        {data.status === 'error' && <ErrorState onRetry={retry} />}

        <div className="records-layout">
          <section className="records-main-column">
            {/* 1. Vital Stats & Trends */}
            <Card
              title="Vital Stats & Trends"
              className="vitals-card"
              action={
                <div className="vitals-toolbar">
                  <label className="visually-hidden" htmlFor="vital-range">
                    Trend range
                  </label>
                  <select id="vital-range" value={range} onChange={(event) => setRange(event.target.value)}>
                    <option value="30d">30 days</option>
                    <option value="90d">90 days</option>
                    <option value="1y">1 year</option>
                  </select>
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => {
                      setVitalType('BLOOD_SUGAR_FASTING');
                      setError('');
                      setModal('vital');
                    }}
                  >
                    <Plus size={13} /> Add reading
                  </Button>
                </div>
              }
            >
              {startLoading ? (
                <Skeleton rows={4} />
              ) : (
                <div className="vitals-grid">
                  {VITALS.map((vital) => (
                    <VitalTile
                      key={vital.type}
                      vital={vital}
                      resource={data.vitals[vital.type]}
                      onAdd={() => {
                        setVitalType(vital.type);
                        setError('');
                        setModal('vital');
                      }}
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* 2. Recent Clinical Records */}
            <Card
              title="Recent Clinical Records"
              className="clinical-records-card"
              action={
                <span className="records-total">
                  {data.status === 'ready' ? `${data.total} record${data.total === 1 ? '' : 's'}` : ''}
                </span>
              }
            >
              <div className="records-filters">
                <label className="record-search">
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search records by title or hospital…"
                    aria-label="Search records"
                  />
                </label>
                <label className="date-filter">
                  <span>From</span>
                  <input
                    type="date"
                    value={from}
                    onChange={(event) => {
                      setFrom(event.target.value);
                      setPage(1);
                    }}
                    aria-label="From date"
                  />
                </label>
                <label className="date-filter">
                  <span>To</span>
                  <input
                    type="date"
                    value={to}
                    onChange={(event) => {
                      setTo(event.target.value);
                      setPage(1);
                    }}
                    aria-label="To date"
                  />
                </label>
              </div>

              {startLoading ? (
                <Skeleton rows={6} />
              ) : records.length ? (
                <>
                  <div className="clinical-record-list">
                    {records.map((record) => (
                      <RecordRow
                        key={record.id}
                        record={record}
                        profileId={activeProfile.id}
                        onView={() => setPreviewRecord(record)}
                        onDelete={() => setRecordToDelete(record)}
                        onVerify={() => setVerificationRecord(record)}
                      />
                    ))}
                  </div>
                  {data.hasMore && (
                    <Button type="button" variant="secondary" className="records-load-more" onClick={loadMore}>
                      Load more
                    </Button>
                  )}
                </>
              ) : (
                <div className="records-empty">
                  <EmptyState text={emptyText(category)} />
                  <Button type="button" variant="secondary" onClick={openUpload}>
                    <UploadCloud size={15} /> Upload medical record (PDF)
                  </Button>
                </div>
              )}
            </Card>

            {/* 3. Vital Readings History (Appears below Recent Clinical Records as requested) */}
            <Card
              title="Vital Readings History"
              className="vitals-history-card"
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setVitalType('BLOOD_SUGAR_FASTING');
                    setError('');
                    setModal('vital');
                  }}
                >
                  <Plus size={13} /> Add reading
                </Button>
              }
            >
              {startLoading ? (
                <Skeleton rows={3} />
              ) : data.vitalsHistory?.length ? (
                <div className="vitals-history-list">
                  {data.vitalsHistory.map((item) => (
                    <div className="vitals-history-row" key={item.id}>
                      <div className="vitals-history-info">
                        <span className={`vital-indicator-dot ${item.type.toLowerCase()}`} />
                        <div className="vitals-history-title-group">
                          <strong>{item.title}</strong>
                          <time>
                            {new Date(item.measuredAt).toLocaleString([], {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </time>
                        </div>
                      </div>
                      <div className="vitals-history-value-group">
                        <span className="vitals-history-value">
                          {item.value} <small>{item.unit}</small>
                        </span>
                        <span className="vitals-history-badge">Logged by you</span>
                        <button
                          type="button"
                          className="record-delete"
                          title="Delete reading"
                          aria-label={`Delete reading from ${item.measuredAt}`}
                          onClick={() => removeVital(item.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="vitals-history-empty">
                  <EmptyState text="No vital readings recorded yet. Use 'Add reading' above to log blood sugar, blood pressure, or cholesterol directly to your database." />
                </div>
              )}
            </Card>
          </section>

          <aside className="records-side-column">
            {/* 4. Chronic Conditions, Allergies & Health Notes */}
            <Card
              title="Chronic Conditions & Allergies"
              className="conditions-card"
              action={
                <Button size="sm" variant="secondary" type="button" onClick={beginConditionsEdit}>
                  Edit / Add
                </Button>
              }
            >
              {startLoading ? (
                <Skeleton rows={4} />
              ) : (
                <>
                  <div className="conditions-section-block">
                    <h4 className="conditions-section-title">Chronic Conditions</h4>
                    <div className="conditions-list">
                      {data.conditions.length ? (
                        data.conditions.map((item) => (
                          <div className="condition-row" key={item.id || item.name}>
                            <div className="condition-info">
                              <span className="condition-name">{item.name}</span>
                              {item.notes && <small className="condition-note-snippet">{item.notes}</small>}
                            </div>
                            <StatusChip status={item.status === 'ACTIVE' ? 'Active' : 'Resolved'} />
                          </div>
                        ))
                      ) : (
                        <EmptyState text="No conditions recorded." />
                      )}
                    </div>
                  </div>

                  <div className="allergy-list-section">
                    <h4 className="conditions-section-title">Known Allergies</h4>
                    <div className="allergy-list">
                      {data.allergies.length ? (
                        data.allergies.map((allergy) => <span key={allergy}>{allergy}</span>)
                      ) : (
                        <em>Not provided</em>
                      )}
                    </div>
                  </div>

                  <div className="conditions-notes-section">
                    <h4 className="conditions-section-title">Personal Health Notes</h4>
                    {data.notes ? (
                      <p className="condition-notes-text">{data.notes}</p>
                    ) : (
                      <p className="condition-notes-empty">
                        No health notes recorded. Click <strong>Edit / Add</strong> to write personal health notes anytime.
                      </p>
                    )}
                  </div>
                </>
              )}
            </Card>
          </aside>
        </div>

        {/* Modal: Upload Record (PDF / Image) */}
        {modal === 'upload' && (
          <Modal title="Upload a health record" onClose={() => !busy && setModal('')}>
            <form className="record-form" onSubmit={submitUpload}>
              <label
                className="record-dropzone"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files?.[0] || null;
                  setUploadFile(file);
                  if (file && !uploadDraft.title) {
                    setUploadDraft((prev) => ({
                      ...prev,
                      title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
                    }));
                  }
                }}
              >
                <UploadCloud size={26} />
                <strong>{uploadFile ? uploadFile.name : 'Drop a PDF or image here, or click to choose file'}</strong>
                <span>PDF, JPG, or PNG · up to 10 MB · Direct Upload</span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setUploadFile(file);
                    if (file && !uploadDraft.title) {
                      setUploadDraft((prev) => ({
                        ...prev,
                        title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
                      }));
                    }
                  }}
                />
              </label>
              <label>
                Record title
                <input
                  required
                  maxLength={160}
                  placeholder="e.g., Blood Sugar Test or Discharge Summary"
                  value={uploadDraft.title}
                  onChange={(event) => setUploadDraft({ ...uploadDraft, title: event.target.value })}
                />
              </label>
              <label>
                Category
                <select
                  value={uploadDraft.category}
                  onChange={(event) => setUploadDraft({ ...uploadDraft, category: event.target.value })}
                >
                  {TABS.slice(1).map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label>
                Hospital or lab <span className="optional">(optional)</span>
                <input
                  maxLength={160}
                  placeholder="e.g., Apollo Diagnostics, City Hospital, etc."
                  value={uploadDraft.issuer}
                  onChange={(event) => setUploadDraft({ ...uploadDraft, issuer: event.target.value })}
                />
              </label>
              <label>
                Record date
                <input
                  type="date"
                  required
                  value={uploadDraft.recordDate}
                  onChange={(event) => setUploadDraft({ ...uploadDraft, recordDate: event.target.value })}
                />
              </label>
              <label>
                Doctor name <span className="optional">(optional — any doctor or hospital)</span>
                <input
                  maxLength={120}
                  placeholder="e.g., Dr. Rajesh Kumar or Dr. Priya Shah"
                  value={uploadDraft.doctorName}
                  onChange={(event) => setUploadDraft({ ...uploadDraft, doctorName: event.target.value })}
                />
              </label>
              {busy && (
                <div className="record-upload-progress" role="progressbar" aria-label="Uploading record">
                  <i />
                </div>
              )}
              {error && (
                <p className="record-form-error" role="alert">
                  {error}
                </p>
              )}
              <footer>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => setModal('')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || !uploadFile}>
                  {busy ? 'Uploading…' : 'Upload record'}
                </Button>
              </footer>
            </form>
          </Modal>
        )}

        {/* Modal: Add Vital Reading */}
        {modal === 'vital' && (
          <Modal title="Add a vital reading" onClose={() => !busy && setModal('')}>
            <form className="record-form" onSubmit={submitVital}>
              <label>
                Vital type
                <select value={vitalType} onChange={(event) => setVitalType(event.target.value)}>
                  <option value="BLOOD_SUGAR_FASTING">Blood Sugar (Fasting)</option>
                  <option value="BLOOD_PRESSURE">Blood Pressure</option>
                  <option value="CHOLESTEROL_TOTAL">Cholesterol (Total)</option>
                  <option value="HEART_RATE">Heart rate</option>
                  <option value="WEIGHT">Weight</option>
                </select>
              </label>
              {vitalType === 'BLOOD_PRESSURE' ? (
                <div className="record-number-pair">
                  <label>
                    Systolic (mmHg)
                    <input
                      required
                      type="number"
                      min="50"
                      max="300"
                      placeholder="120"
                      value={vitalDraft.systolic}
                      onChange={(event) => setVitalDraft({ ...vitalDraft, systolic: event.target.value })}
                    />
                  </label>
                  <label>
                    Diastolic (mmHg)
                    <input
                      required
                      type="number"
                      min="30"
                      max="200"
                      placeholder="80"
                      value={vitalDraft.diastolic}
                      onChange={(event) => setVitalDraft({ ...vitalDraft, diastolic: event.target.value })}
                    />
                  </label>
                </div>
              ) : (
                <label>
                  Value ({vitalType === 'BLOOD_SUGAR_FASTING' || vitalType === 'CHOLESTEROL_TOTAL' ? 'mg/dL' : vitalType === 'HEART_RATE' ? 'bpm' : 'kg'})
                  <input
                    required
                    type="number"
                    step="any"
                    placeholder="Enter reading"
                    value={vitalDraft.value}
                    onChange={(event) => setVitalDraft({ ...vitalDraft, value: event.target.value })}
                  />
                </label>
              )}
              <label>
                Measured at
                <input
                  required
                  type="datetime-local"
                  value={vitalDraft.measuredAt}
                  onChange={(event) => setVitalDraft({ ...vitalDraft, measuredAt: event.target.value })}
                />
              </label>
              {error && (
                <p className="record-form-error" role="alert">
                  {error}
                </p>
              )}
              <footer>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => setModal('')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save reading to database'}
                </Button>
              </footer>
            </form>
          </Modal>
        )}

        {/* Modal: Chronic Conditions, Allergies & Personal Notes */}
        {modal === 'conditions' && (
          <Modal title="Conditions, Allergies & Notes" onClose={() => !busy && setModal('')}>
            <form className="record-form" onSubmit={submitConditions}>
              <div>
                <strong style={{ fontSize: '11px', color: '#2c444c' }}>Chronic Conditions</strong>
                <div className="condition-edit-list" style={{ marginTop: '6px' }}>
                  {conditionsDraft.map((condition, index) => (
                    <div className="condition-edit-row" key={`${index}-${condition.name}`}>
                      <label>
                        Condition
                        <input
                          placeholder="e.g., Hypertension or Type 2 Diabetes"
                          value={condition.name}
                          onChange={(event) =>
                            setConditionsDraft(
                              conditionsDraft.map((item, i) =>
                                i === index ? { ...item, name: event.target.value } : item
                              )
                            )
                          }
                        />
                      </label>
                      <label>
                        Status
                        <select
                          value={condition.status}
                          onChange={(event) =>
                            setConditionsDraft(
                              conditionsDraft.map((item, i) =>
                                i === index ? { ...item, status: event.target.value } : item
                              )
                            )
                          }
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="RESOLVED">Resolved</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        aria-label="Remove condition"
                        onClick={() => setConditionsDraft(conditionsDraft.filter((_, i) => i !== index))}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  style={{ marginTop: '8px' }}
                  onClick={() => setConditionsDraft([...conditionsDraft, { name: '', status: 'ACTIVE', since: '', notes: '' }])}
                >
                  <Plus size={14} /> Add condition
                </Button>
              </div>

              <label>
                Allergies <span className="optional">(comma separated)</span>
                <input
                  value={allergyDraft}
                  onChange={(event) => setAllergyDraft(event.target.value)}
                  placeholder="For example: Penicillin, Pollen, Peanuts"
                />
              </label>

              <label>
                Personal Health Notes <span className="optional">(stored directly to your database)</span>
                <textarea
                  className="record-textarea"
                  rows={3}
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  placeholder="Add notes about diet, medication reactions, vitals monitoring instructions, etc."
                />
              </label>

              {error && (
                <p className="record-form-error" role="alert">
                  {error}
                </p>
              )}
              <footer>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => setModal('')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save changes to database'}
                </Button>
              </footer>
            </form>
          </Modal>
        )}

        {previewRecord && (
          <Modal
            title={previewRecord.title || 'Medical Record'}
            onClose={() => setPreviewRecord(null)}
            className="record-preview-modal"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>{previewRecord.title}</strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {previewRecord.category} · {previewRecord.issuer} · {displayDate(previewRecord.recordDate)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a
                    href={recordFileUrl(previewRecord.id, activeProfile.id, 'attachment')}
                    download={previewRecord.fileName || previewRecord.title}
                    className="patient-button primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', fontSize: '12px', padding: '6px 12px' }}
                  >
                    <Download size={14} /> Download File
                  </a>
                  <a
                    href={recordFileUrl(previewRecord.id, activeProfile.id, 'inline')}
                    target="_blank"
                    rel="noreferrer"
                    className="patient-button secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', fontSize: '12px', padding: '6px 12px' }}
                  >
                    Open in Full Tab ↗
                  </a>
                </div>
              </div>

              <div style={{ width: '100%', height: '65vh', background: '#f1f5f9', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                <iframe
                  src={recordFileUrl(previewRecord.id, activeProfile.id, 'inline')}
                  title={previewRecord.title}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            </div>
          </Modal>
        )}

        {recordToDelete && (
          <ConfirmDialog
            title="Remove this record?"
            message={`“${recordToDelete.title}” will be removed from your health records.`}
            confirmText="Remove record"
            onCancel={() => setRecordToDelete(null)}
            onConfirm={removeRecord}
            busy={busy}
          />
        )}

        {verificationRecord && (
          <DocumentVerificationModal
            record={verificationRecord}
            profileId={activeProfile.id}
            onClose={() => setVerificationRecord(null)}
            onUpdated={() => {
              retry();
              setVerificationRecord(null);
            }}
          />
        )}
      </main>
    </PatientLayout>
  );
}

function todayDateValue(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function emptyText(category) {
  const label = TABS.find(([key]) => key === category)?.[1]?.toLowerCase();
  return category === 'ALL' ? 'No health records yet.' : `No ${label || 'records'} yet.`;
}

function VitalTile({ vital, resource, onAdd }) {
  const latest = resource?.latest;
  const points = resource?.points || [];
  const value =
    latest
      ? vital.type === 'BLOOD_PRESSURE'
        ? `${latest.systolic}/${latest.diastolic ?? '—'}`
        : latest.value
      : null;
  const unit = latest?.unit || vital.unit;
  const chartValues =
    vital.type === 'BLOOD_PRESSURE' ? points.map((point) => point.systolic) : points.map((point) => point.value);
  const trend =
    chartValues.length > 1
      ? chartValues.at(-1) >= chartValues[0]
        ? 'trending up'
        : 'trending down'
      : 'trend unavailable';

  return (
    <article className={`vital-tile ${vital.tone}`}>
      <h3>{vital.title}</h3>
      {value == null ? (
        <div className="vital-empty">
          <span>No data yet</span>
          <button type="button" onClick={onAdd}>
            Add reading
          </button>
        </div>
      ) : (
        <>
          <strong>
            {value}
            <small> {unit}</small>
          </strong>
          <Sparkline values={chartValues} label={`${vital.title}, latest ${value} ${unit}, ${trend}`} />
        </>
      )}
    </article>
  );
}

function Sparkline({ values, label }) {
  if (!values.length)
    return (
      <svg className="vital-sparkline" role="img" aria-label={label} viewBox="0 0 140 32">
        <path d="M2 27H138" />
      </svg>
    );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => `${2 + index * (136 / Math.max(1, values.length - 1))},${28 - ((value - min) / range) * 22}`)
    .join(' ');
  return (
    <svg className="vital-sparkline" role="img" aria-label={label} viewBox="0 0 140 32" preserveAspectRatio="none">
      <polyline points={points} />
    </svg>
  );
}

function RecordRow({ record, profileId, onView, onDelete, onVerify }) {
  const Icon = record.mimeType?.startsWith('image/') ? FileImage : FileText;
  const status = record.verificationStatus || 'PENDING';
  const getBadgeStyle = () => {
    switch (status) {
      case 'AI_VERIFIED':
        return { bg: '#e6fffa', border: '#99f6e4', color: '#0d9488', text: '✨ AI Verified' };
      case 'DOCTOR_VERIFIED':
        return { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', text: '✓ Doctor Verified' };
      case 'DOCTOR_REVIEW_PENDING':
        return { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', text: '⏳ Review Pending' };
      case 'DOCTOR_REVIEW_REQUIRED':
        return { bg: '#fffbeb', border: '#fde68a', color: '#b45309', text: '⚠️ Doctor Review Required' };
      case 'REJECTED':
        return { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', text: '✕ Rejected' };
      default:
        return { bg: '#f1f5f9', border: '#e2e8f0', color: '#64748b', text: 'Pending Verification' };
    }
  };
  const badge = getBadgeStyle();

  return (
    <article className="clinical-record-row">
      <span className="record-file-icon" onClick={onView} style={{ cursor: 'pointer' }} title="Click to view file">
        <Icon size={19} />
      </span>
      <div className="record-summary">
        <div className="record-title-line">
          <strong onClick={onView} style={{ cursor: 'pointer' }} title="Click to view file">
            {record.title}
          </strong>
          <span className="record-format-badge">{record.fileType}</span>
        </div>
        <span className="record-issuer">
          {record.issuer} · {displayDate(record.recordDate)}
        </span>
        <div className="record-owner-line" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          {record.doctor ? (
            <>
              {record.doctor.photoUrl ? (
                <img className="record-doctor-photo" src={record.doctor.photoUrl} alt={record.doctor.name} />
              ) : (
                <Avatar
                  name={record.doctor.name}
                  initials={record.doctor.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')}
                  size="sm"
                />
              )}
              <span>{record.doctor.name}</span>
            </>
          ) : (
            <span className="record-owner-upload">Uploaded by you</span>
          )}
          <StatusChip
            status={record.category
              .replaceAll('_', ' ')
              .replace('LAB REPORT', 'Lab Report')
              .replace('DISCHARGE SUMMARY', 'Discharge Summary')}
          />
          <button
            type="button"
            onClick={onVerify}
            title="Inspect AI validation details or request doctor review"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              background: badge.bg,
              border: `1px solid ${badge.border}`,
              color: badge.color,
              cursor: 'pointer',
              lineHeight: '1.4',
            }}
          >
            {badge.text}
          </button>
        </div>
      </div>
      <div className="record-actions">
        <button
          type="button"
          className="patient-button light"
          onClick={onVerify}
          title="View document verification & review status"
          style={{ padding: '0 8px', fontSize: '11px' }}
        >
          Status
        </button>
        <button
          type="button"
          className="patient-button secondary"
          onClick={onView}
          aria-label={`View ${record.title}`}
        >
          View
        </button>
        <a
          className="patient-button light"
          href={recordFileUrl(record.id, profileId, 'inline')}
          target="_blank"
          rel="noreferrer"
          title="Open file in new tab"
          style={{ padding: '0 8px', fontSize: '11px', textDecoration: 'none' }}
        >
          ↗
        </a>
        <a
          className="record-download"
          href={recordFileUrl(record.id, profileId, 'attachment')}
          download={record.fileName || record.title}
          aria-label={`Download ${record.title}`}
          title="Download file"
        >
          <Download size={16} />
        </a>
        {record.source === 'PATIENT_UPLOAD' && (
          <button
            type="button"
            className="record-delete"
            onClick={onDelete}
            aria-label={`Remove ${record.title}`}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </article>
  );
}

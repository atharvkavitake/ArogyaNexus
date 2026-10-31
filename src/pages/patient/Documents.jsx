import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileImage, FileText, Filter, Grid2X2, List, Search, ShieldCheck, Sparkles, CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';
import PatientLayout from '../../components/patient/PatientLayout';
import { Button, Card, ConfirmDialog, Dropzone, EmptyState, ErrorState, FilePreviewModal, Modal, Popover, TagInput } from '../../components/ui';
import DocumentVerificationModal from '../../components/patient/DocumentVerificationModal';
import { useActiveProfile } from '../../contexts/activeProfile';
import { addDocument, deleteDocument, getDocuments, updateDocument } from '../../api/documents';
import { validateDocumentFile } from '../../utils/patientData';
import { usePatientToast } from '../../hooks/usePatientToast.jsx';
import '../../styles/patient-batch2.css';

const filters = ['All', 'Lab', 'Scan', 'Prescription', 'Insurance', 'Other'];
const formatSize = (n) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
const displayDate = (v) =>
  new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function DocumentsPage() {
  const { activeProfile } = useActiveProfile();
  const [docs, setDocs] = useState([]);
  const [state, setState] = useState('loading');
  const [reload, setReload] = useState(0);
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [layout, setLayout] = useState(() => localStorage.getItem('arogyanexus.documents.layout') || 'grid');
  const [filterOpen, setFilterOpen] = useState(false);
  const [queue, setQueue] = useState([]);
  const [renameTarget, setRenameTarget] = useState(null);
  const [name, setName] = useState('');
  const [tags, setTags] = useState([]);
  const [editTarget, setEditTarget] = useState(null);
  const [preview, setPreview] = useState(null);
  const [verificationDoc, setVerificationDoc] = useState(null);
  const [remove, setRemove] = useState(null);
  const [busy, setBusy] = useState(false);
  const [localFiles, setLocalFiles] = useState({});
  const { show, toastNode } = usePatientToast();

  const load = useCallback(() => {
    void reload;
    let live = true;
    setState('loading');
    getDocuments(activeProfile.id)
      .then((rows) => {
        if (live) {
          setDocs(rows);
          setState('ready');
        }
      })
      .catch(() => live && setState('error'));
    return () => {
      live = false;
    };
  }, [activeProfile.id, reload]);

  useEffect(load, [load]);

  const visible = useMemo(
    () =>
      docs
        .filter(
          (d) =>
            (category === 'All' ||
              d.type === category.toUpperCase() ||
              (category === 'Other' && !filters.slice(1, -1).some((f) => f.toUpperCase() === d.type))) &&
            (!query || `${d.name} ${d.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
        )
        .sort((a, b) =>
          sort === 'name'
            ? a.name.localeCompare(b.name)
            : sort === 'size'
            ? b.sizeBytes - a.sizeBytes
            : new Date(b.uploadedAt) - new Date(a.uploadedAt)
        ),
    [docs, category, query, sort]
  );

  const storage = 39 * 1024 * 1024 + docs.reduce((sum, d) => sum + d.sizeBytes, 0);
  const setView = (v) => {
    setLayout(v);
    localStorage.setItem('arogyanexus.documents.layout', v);
  };

  const handleFiles = async (files) => {
    const initial = files.map((file, index) => ({
      id: `queue-${Date.now()}-${index}`,
      file,
      name: file.name,
      progress: 0,
      error: validateDocumentFile(file),
      status: 'validating',
    }));
    setQueue((q) => [...initial, ...q]);
    const valid = initial.filter((x) => !x.error);
    for (const item of valid) {
      setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: 'uploading' } : x)));
      for (const progress of [25, 52, 78, 100]) {
        await new Promise((r) => setTimeout(r, 110));
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, progress } : x)));
      }
      try {
        const file = item.file;
        const row = await addDocument(
          activeProfile.id,
          {
            name: file.name,
            title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
            type: inferType(file.name),
            tags: [],
            sizeBytes: file.size,
            mimeType: file.type,
            uploadedAt: new Date().toISOString(),
          },
          file
        );
        setDocs((d) => [row, ...d]);
        setLocalFiles((f) => ({ ...f, [row.id]: file }));
        setQueue((q) => q.filter((x) => x.id !== item.id));

        const isAiVerified = row.verificationStatus === 'AI_VERIFIED';
        show({
          title: isAiVerified ? 'Document AI-Verified' : 'Document uploaded',
          message: isAiVerified
            ? `${file.name} passed automated format validation.`
            : `${file.name} uploaded. You can request doctor verification.`,
        });
      } catch {
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, error: 'Upload failed. Try again.', status: 'error' } : x)));
      }
    }
  };

  const saveRename = async (e) => {
    e.preventDefault();
    if (!editTarget) return;
    setBusy(true);
    try {
      const updated = await updateDocument(activeProfile.id, editTarget.id, renameTarget ? { name: name.trim() } : { tags });
      setDocs((d) => d.map((x) => (x.id === updated.id ? updated : x)));
      setRenameTarget(null);
      setEditTarget(null);
      show({ title: 'Document updated', message: 'Your changes have been saved.' });
    } catch {
      show({ title: 'Update failed', message: 'Please try again.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = async () => {
    if (!remove) return;
    setBusy(true);
    try {
      await deleteDocument(activeProfile.id, remove.id);
      setDocs((d) => d.filter((x) => x.id !== remove.id));
      setRemove(null);
      show({ title: 'Document deleted', message: `${remove.name} removed.` });
    } catch {
      show({ title: 'Delete failed', message: 'Please try again.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (doc, isRename) => {
    setEditTarget(doc);
    setRenameTarget(isRename ? doc : null);
    setName(doc.name);
    setTags([...doc.tags]);
  };

  const download = (doc) => {
    const file = localFiles[doc.id];
    if (file) {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([`ArogyaNexus demo file: ${doc.name}`], { type: doc.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <PatientLayout profile={activeProfile}>
      <main className="patient-content patient-documents-page">
        {activeProfile.id !== 'me' && (
          <div className={`active-profile-banner ${activeProfile.color}`}>
            <ShieldCheck size={17} />
            <span>
              Viewing <strong>{activeProfile.name}’s</strong> private documents
            </span>
          </div>
        )}
        <header className="patient-page-heading">
          <div>
            <p>YOUR PRIVATE FILES</p>
            <h2>Documents</h2>
            <span>Keep important health documents together.</span>
          </div>
          <div className="documents-storage">
            <strong>{(storage / 1024 / 1024).toFixed(1)} MB</strong>
            <span>of 500 MB used</span>
            <i>
              <b style={{ width: `${Math.min(100, (storage / (500 * 1024 * 1024)) * 100)}%` }} />
            </i>
          </div>
        </header>

        <Card className="documents-upload-card">
          <Dropzone onFiles={handleFiles}>Drop files here or click to browse</Dropzone>
          <p className="documents-private-note">
            <ShieldCheck size={14} /> Documents you upload are private. Doctors can see them only when you give consent.
          </p>
          {queue.length > 0 && (
            <div className="document-upload-queue" aria-live="polite">
              {queue.map((item) => (
                <div className="document-upload-row" key={item.id}>
                  <FileText size={16} />
                  <span>{item.name}</span>
                  {item.error ? (
                    <strong className="upload-error">{item.error}</strong>
                  ) : (
                    <div className="document-upload-progress" role="progressbar" aria-valuenow={item.progress} aria-valuemin="0" aria-valuemax="100">
                      <i style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="documents-toolbar">
          <div className="documents-filter-chips" role="group" aria-label="Filter documents">
            {filters.map((x) => (
              <button type="button" className={category === x ? 'selected' : ''} key={x} onClick={() => setCategory(x)}>
                {x}
              </button>
            ))}
          </div>
          <Button className="documents-filter-drawer-toggle" variant="secondary" onClick={() => setFilterOpen(true)}>
            <Filter size={14} /> Filters
          </Button>
          <label className="documents-search">
            <Search size={15} />
            <input aria-label="Search documents" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents or tags" />
          </label>
          <label className="documents-sort">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
            </select>
          </label>
          <div className="documents-view-toggle">
            <button type="button" aria-label="Grid view" aria-pressed={layout === 'grid'} className={layout === 'grid' ? 'selected' : ''} onClick={() => setView('grid')}>
              <Grid2X2 size={16} />
            </button>
            <button type="button" aria-label="List view" aria-pressed={layout === 'list'} className={layout === 'list' ? 'selected' : ''} onClick={() => setView('list')}>
              <List size={16} />
            </button>
          </div>
        </div>

        {state === 'error' ? (
          <ErrorState onRetry={() => setReload((n) => n + 1)} />
        ) : state === 'loading' ? (
          <div className="documents-grid">
            <Card state="loading" />
            <Card state="loading" />
            <Card state="loading" />
          </div>
        ) : visible.length ? (
          <div className={`documents-grid ${layout}`}>
            {visible.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onView={() => setPreview({ ...doc, previewUrl: localFiles[doc.id] ? URL.createObjectURL(localFiles[doc.id]) : undefined })}
                onDownload={() => download(doc)}
                onRename={() => openEdit(doc, true)}
                onTags={() => openEdit(doc, false)}
                onDelete={() => setRemove(doc)}
                onVerify={() => setVerificationDoc(doc)}
              />
            ))}
          </div>
        ) : (
          <Card className="documents-empty">
            <EmptyState text={docs.length ? 'No documents match those filters.' : 'No documents uploaded for this profile yet.'} />
          </Card>
        )}

        {filterOpen && (
          <Modal title="Filter documents" onClose={() => setFilterOpen(false)}>
            <div className="documents-drawer-filters">
              <strong>Category</strong>
              <div className="documents-filter-chips">
                {filters.map((x) => (
                  <button type="button" className={category === x ? 'selected' : ''} key={x} onClick={() => setCategory(x)}>
                    {x}
                  </button>
                ))}
              </div>
              <label>
                Sort
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="newest">Newest</option>
                  <option value="name">Name</option>
                  <option value="size">Size</option>
                </select>
              </label>
              <Button onClick={() => setFilterOpen(false)}>Show {visible.length} documents</Button>
            </div>
          </Modal>
        )}

        {editTarget && (
          <Modal title={renameTarget ? 'Rename document' : 'Edit document tags'} onClose={() => !busy && setEditTarget(null)}>
            <form className="record-form" onSubmit={saveRename}>
              {renameTarget ? (
                <label>
                  File name
                  <input required value={name} onChange={(e) => setName(e.target.value)} />
                </label>
              ) : (
                <label>
                  Tags
                  <TagInput value={tags} onChange={setTags} placeholder="Type a tag and press Enter" />
                </label>
              )}
              <footer>
                <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>
                  Cancel
                </Button>
                <Button disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
              </footer>
            </form>
          </Modal>
        )}

        {preview && (
          <FilePreviewModal
            file={preview}
            onClose={() => {
              if (preview.previewUrl) URL.revokeObjectURL(preview.previewUrl);
              setPreview(null);
            }}
          />
        )}

        {verificationDoc && (
          <DocumentVerificationModal
            record={verificationDoc}
            profileId={activeProfile.id}
            onClose={() => setVerificationDoc(null)}
            onUpdated={() => {
              load();
              setVerificationDoc(null);
            }}
          />
        )}

        {remove && (
          <ConfirmDialog
            title="Delete document?"
            message={`Delete ${remove.name} from this profile? This cannot be undone.`}
            confirmText="Delete document"
            onCancel={() => setRemove(null)}
            onConfirm={removeDoc}
            busy={busy}
          />
        )}
        {toastNode}
      </main>
    </PatientLayout>
  );
}

function inferType(name) {
  const x = name.toLowerCase();
  if (x.includes('prescription')) return 'PRESCRIPTION';
  if (x.includes('insurance')) return 'INSURANCE';
  if (x.includes('scan') || x.includes('echo') || x.includes('xray') || x.includes('mri')) return 'SCAN';
  if (x.includes('lab') || x.includes('blood') || x.includes('cbc')) return 'LAB';
  return 'OTHER';
}

function DocumentCard({ doc, onView, onDownload, onRename, onTags, onDelete, onVerify }) {
  const Icon = doc.mimeType?.startsWith('image/') ? FileImage : FileText;
  const run = (event, action) => {
    event.currentTarget.closest('details').open = false;
    action();
  };

  const status = doc.verificationStatus || 'PENDING';
  const getBadge = () => {
    switch (status) {
      case 'AI_VERIFIED':
        return { text: '✨ AI Verified', bg: '#e6fffa', color: '#0d9488', border: '#99f6e4' };
      case 'DOCTOR_VERIFIED':
        return { text: '✓ Doctor Verified', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
      case 'DOCTOR_REVIEW_PENDING':
        return { text: '⏳ Review Pending', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
      case 'DOCTOR_REVIEW_REQUIRED':
        return { text: '⚠️ Doctor Review', bg: '#fffbeb', color: '#b45309', border: '#fde68a' };
      case 'REJECTED':
        return { text: '✕ Rejected', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' };
      default:
        return { text: 'Pending Verification', bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' };
    }
  };
  const badge = getBadge();

  return (
    <article className="document-card">
      <div className="document-card-head">
        <span className={`document-type-icon ${doc.type.toLowerCase()}`}>
          <Icon size={19} />
        </span>
        <span className="document-type-label">{doc.type}</span>
        <Popover label={`Actions for ${doc.name}`}>
          <button onClick={(e) => run(e, onView)}>View</button>
          <button onClick={(e) => run(e, onVerify)}>Verification Status</button>
          <button onClick={(e) => run(e, onDownload)}>Download</button>
          <button onClick={(e) => run(e, onRename)}>Rename</button>
          <button onClick={(e) => run(e, onTags)}>Edit tags</button>
          <button className="danger" onClick={(e) => run(e, onDelete)}>
            Delete
          </button>
        </Popover>
      </div>

      <button type="button" className="document-open" onClick={onView}>
        <strong>{doc.name}</strong>
        <span>
          {displayDate(doc.uploadedAt)} · {formatSize(doc.sizeBytes)}
        </span>
      </button>

      {/* Verification Status Pill */}
      <div style={{ padding: '0 12px 6px' }}>
        <button
          type="button"
          onClick={onVerify}
          title="Click to view AI check details or request doctor review"
          style={{
            border: `1px solid ${badge.border}`,
            background: badge.bg,
            color: badge.color,
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '12px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {badge.text}
        </button>
      </div>

      <div className="document-tags">
        {doc.tags.length ? doc.tags.map((tag) => <span key={tag}>{tag}</span>) : <small>No tags</small>}
      </div>

      <button className="document-download" type="button" onClick={onDownload}>
        <Download size={14} /> Download
      </button>
    </article>
  );
}

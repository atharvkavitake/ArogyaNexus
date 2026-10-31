import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Bot, AlertTriangle, AlertCircle, ShieldAlert,
  FileText, Copy, Check, RefreshCw, X, ExternalLink,
  Activity, Heart, Droplets, Scale, Stethoscope, ChevronRight
} from 'lucide-react';
import { getAiClinicalSummary } from '../../api/doctorAppointments';
import '../../styles/doctor-ai-summary.css';

export default function AiClinicalSummaryModal({ appointment, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('structured'); // 'structured' | 'markdown'
  const [loadingStep, setLoadingStep] = useState(0);

  const steps = [
    'Verifying doctor access permissions & records…',
    'Extracting textual lab findings from uploaded PDFs…',
    'Analyzing vital timelines, trends & chronic ailments…',
    'Generating structured clinical recommendations with Gemini…',
  ];

  const fetchSummary = useCallback(async () => {
    if (!appointment?.id) return;
    setLoading(true);
    setError('');
    setLoadingStep(0);

    const stepInterval = setInterval(() => {
      setLoadingStep((s) => (s < steps.length - 1 ? s + 1 : s));
    }, 900);

    try {
      const summary = await getAiClinicalSummary(appointment.id);
      setData(summary);
    } catch (err) {
      console.error('[AI Modal] Failed to load summary:', err);
      setError(err.message || 'Could not generate clinical summary.');
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  }, [appointment?.id]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = () => {
    if (!data?.aiOutput?.fullMarkdown) return;
    navigator.clipboard.writeText(data.aiOutput.fullMarkdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const patient = data?.patient || appointment?.patient || {};
  const aiOutput = data?.aiOutput || {};
  const vitals = data?.vitals?.recent || {};

  return (
    <div
      className="ai-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-summary-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ai-modal-container">
        {/* Header */}
        <header className="ai-modal-header">
          <div className="ai-header-left">
            <span className="ai-badge-avatar">
              <Bot size={24} />
            </span>
            <div className="ai-header-title">
              <h2 id="ai-summary-title">
                AI Clinical Assistant
                <span className="ai-live-pill">
                  <span className="ai-live-dot" /> Gemini Clinical AI
                </span>
              </h2>
              <p>Automated Patient Summary, Lab Extraction & Clinical Insights</p>
            </div>
          </div>
          <button
            type="button"
            className="ai-close-btn"
            aria-label="Close summary"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>

        {/* Patient Ribbon */}
        <div className="ai-patient-ribbon">
          <div className="ai-patient-info">
            <span className="ai-patient-name">{patient.name || 'Patient'}</span>
            <span className="ai-tag">
              {patient.age ? `${patient.age} yrs` : ''}{patient.gender ? ` · ${patient.gender}` : ''}
            </span>
            {patient.bloodGroup && (
              <span className="ai-tag blood">Blood: {patient.bloodGroup}</span>
            )}
            <span className="ai-tag token">
              Token #{String(appointment?.tokenNumber || 1).padStart(2, '0')}
            </span>
            <span className="ai-tag">
              Reason: <em>{appointment?.reason || 'General Consultation'}</em>
            </span>
          </div>

          <div className="ai-ribbon-actions">
            <button
              type="button"
              className={`ai-ribbon-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              disabled={loading || !aiOutput.fullMarkdown}
              title="Copy clinical markdown to clipboard"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy Brief'}</span>
            </button>

            <button
              type="button"
              className="ai-ribbon-btn"
              onClick={fetchSummary}
              disabled={loading}
              title="Regenerate summary with AI"
            >
              <RefreshCw size={14} className={loading ? 'sparkle-icon' : ''} />
              <span>{loading ? 'Analyzing…' : 'Regenerate'}</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="ai-modal-body">
          {loading ? (
            <div className="ai-loading-box">
              <div className="ai-spinner-halo" />
              <h3 className="ai-loading-title">Analyzing clinical vitals & PDF records…</h3>
              <div className="ai-loading-steps">
                {steps.map((text, idx) => (
                  <div className="ai-step-item" key={text} style={{ opacity: idx <= loadingStep ? 1 : 0.4 }}>
                    <span className="ai-step-dot" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="ai-alert-card critical" style={{ padding: '24px' }}>
              <AlertTriangle size={24} />
              <div>
                <strong>Unable to generate summary</strong>
                <p style={{ margin: '4px 0 12px' }}>{error}</p>
                <button
                  type="button"
                  className="ai-ribbon-btn"
                  onClick={fetchSummary}
                  style={{ background: '#fff' }}
                >
                  <RefreshCw size={14} /> Try Again
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Critical Alerts Banner */}
              {aiOutput.criticalAlerts && aiOutput.criticalAlerts.length > 0 && (
                <div className="ai-alerts-grid">
                  {aiOutput.criticalAlerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className={`ai-alert-card ${alert.type || 'warning'}`}
                    >
                      {alert.type === 'critical' ? (
                        <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                      ) : alert.type === 'allergy' ? (
                        <ShieldAlert size={18} style={{ flexShrink: 0 }} />
                      ) : (
                        <AlertCircle size={18} style={{ flexShrink: 0 }} />
                      )}
                      <div>
                        <strong>{alert.title}</strong>
                        <span>{alert.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 1. Quick Overview Card */}
              <div className="ai-section-card">
                <h3 className="ai-section-title">
                  <Stethoscope size={16} className="section-icon" />
                  1. Clinical Overview
                </h3>
                <p className="ai-overview-text">
                  {aiOutput.overview || 'Comprehensive profile assembled from clinic notes and history.'}
                </p>

                {/* Vitals Quick Strip */}
                {Object.keys(vitals).length > 0 && (
                  <div className="ai-vitals-strip">
                    {vitals['BP_SYSTOLIC'] && vitals['BP_DIASTOLIC'] && (
                      <div className={`ai-vital-item ${vitals['BP_SYSTOLIC'].value >= 140 ? 'alert' : ''}`}>
                        <small>Blood Pressure</small>
                        <strong>
                          {vitals['BP_SYSTOLIC'].value}/{vitals['BP_DIASTOLIC'].value} <span style={{ fontSize: '11px', fontWeight: 500 }}>mmHg</span>
                        </strong>
                      </div>
                    )}
                    {vitals['BLOOD_SUGAR_FASTING'] && (
                      <div className={`ai-vital-item ${vitals['BLOOD_SUGAR_FASTING'].value >= 126 ? 'alert' : ''}`}>
                        <small>Fasting Sugar</small>
                        <strong>
                          {vitals['BLOOD_SUGAR_FASTING'].value} <span style={{ fontSize: '11px', fontWeight: 500 }}>mg/dL</span>
                        </strong>
                      </div>
                    )}
                    {vitals['HEART_RATE'] && (
                      <div className={`ai-vital-item ${vitals['HEART_RATE'].value >= 90 ? 'alert' : ''}`}>
                        <small>Heart Rate</small>
                        <strong>
                          {vitals['HEART_RATE'].value} <span style={{ fontSize: '11px', fontWeight: 500 }}>bpm</span>
                        </strong>
                      </div>
                    )}
                    {vitals['CHOLESTEROL_TOTAL'] && (
                      <div className={`ai-vital-item ${vitals['CHOLESTEROL_TOTAL'].value >= 200 ? 'alert' : ''}`}>
                        <small>Cholesterol</small>
                        <strong>
                          {vitals['CHOLESTEROL_TOTAL'].value} <span style={{ fontSize: '11px', fontWeight: 500 }}>mg/dL</span>
                        </strong>
                      </div>
                    )}
                    {vitals['WEIGHT'] && (
                      <div className="ai-vital-item">
                        <small>Body Weight</small>
                        <strong>
                          {vitals['WEIGHT'].value} <span style={{ fontSize: '11px', fontWeight: 500 }}>kg</span>
                        </strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Key Lab Findings (Extracted from PDFs) */}
              <div className="ai-section-card">
                <h3 className="ai-section-title">
                  <FileText size={16} className="section-icon" />
                  2. Key Lab Findings (Extracted from Uploaded PDFs)
                </h3>

                {aiOutput.keyLabFindings && aiOutput.keyLabFindings.length > 0 ? (
                  <div className="ai-lab-list">
                    {aiOutput.keyLabFindings.map((finding, idx) => {
                      // Match source record for quick PDF viewing
                      const matchingRecord = data?.sourceRecords?.find(
                        (r) =>
                          r.title.toLowerCase().includes(finding.testName.toLowerCase().slice(0, 10)) ||
                          finding.testName.toLowerCase().includes(r.title.toLowerCase().slice(0, 10))
                      );

                      return (
                        <div className="ai-lab-item" key={idx}>
                          <div className="ai-lab-item-header">
                            <span className="ai-lab-name">
                              {finding.testName} {finding.date ? `(${finding.date})` : ''}
                            </span>
                            {matchingRecord && (
                              <a
                                href={matchingRecord.viewUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="ai-pdf-link"
                                title="Open original PDF report in new tab"
                              >
                                <ExternalLink size={12} /> View Source PDF
                              </a>
                            )}
                          </div>
                          {finding.abnormalValues && (
                            <div>
                              <span className="ai-lab-abnormal">
                                Abnormal Biomarkers: {finding.abnormalValues}
                              </span>
                            </div>
                          )}
                          <p className="ai-lab-conclusion">{finding.conclusion}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '12px', color: '#627882' }}>
                    No lab reports currently uploaded.
                  </p>
                )}
              </div>

              {/* 3. Active Conditions & History */}
              <div className="ai-section-card">
                <h3 className="ai-section-title">
                  <Activity size={16} className="section-icon" />
                  3. Active Conditions & Medical History
                </h3>
                {aiOutput.activeConditions && aiOutput.activeConditions.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#384d56', lineHeight: 1.6 }}>
                    {aiOutput.activeConditions.map((cond, idx) => (
                      <li key={idx}>
                        <strong>{cond.condition}:</strong> {cond.timeline ? `${cond.timeline} · ` : ''}{cond.notes}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: 0, fontSize: '12px', color: '#627882' }}>
                    No chronic conditions on record.
                  </p>
                )}
              </div>

              {/* 4. Clinical Recommendations for Doctor */}
              <div className="ai-section-card">
                <h3 className="ai-section-title">
                  <Sparkles size={16} className="section-icon" />
                  4. Clinical Recommendations for Attending Doctor
                </h3>
                {aiOutput.recommendations && aiOutput.recommendations.length > 0 ? (
                  <div className="ai-recommendations-list">
                    {aiOutput.recommendations.map((rec, idx) => {
                      const isAllergy = rec.category?.toLowerCase().includes('allergy') || rec.advice?.toLowerCase().includes('contraindicat');
                      const isImmediate = rec.category?.toLowerCase().includes('immediate') || rec.category?.toLowerCase().includes('urgent');
                      return (
                        <div
                          key={idx}
                          className={`ai-rec-item ${isAllergy ? 'allergy-warning' : isImmediate ? 'immediate' : ''}`}
                        >
                          <ChevronRight size={16} style={{ color: isAllergy ? '#892dc4' : isImmediate ? '#d13a29' : '#167c84', flexShrink: 0, marginTop: '2px' }} />
                          <div className="ai-rec-content">
                            <span className="ai-rec-cat">{rec.category}</span>
                            <p className="ai-rec-text">{rec.advice}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '12px', color: '#627882' }}>
                    No specific clinical warnings generated.
                  </p>
                )}
              </div>

              {/* Source Records Links Footer */}
              {data?.sourceRecords && data.sourceRecords.length > 0 && (
                <div className="ai-section-card" style={{ background: '#f5f9fa' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#27434c', fontWeight: 700 }}>
                    Source Medical Records Analyzed ({data.sourceRecords.length}):
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {data.sourceRecords.map((rec) => (
                      <a
                        key={rec.id}
                        href={rec.viewUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="ai-pdf-link"
                        style={{ fontSize: '11px', padding: '5px 10px' }}
                      >
                        <FileText size={13} /> {rec.title} ({rec.category})
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="ai-modal-footer">
          <div className="ai-model-tag">
            <Sparkles size={13} style={{ color: '#0e7066' }} />
            <span>Generated with {aiOutput.modelUsed || 'Gemini Flash'}</span>
            {aiOutput.generatedAt && (
              <span style={{ fontWeight: 400, color: '#6c838b' }}>
                · {new Date(aiOutput.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <button type="button" className="ai-footer-btn" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}

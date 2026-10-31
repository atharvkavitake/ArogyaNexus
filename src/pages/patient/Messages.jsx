import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  MessageCircle,
  Send,
  Search,
  Calendar,
  CheckCheck,
  Check,
  Stethoscope,
  BadgeCheck,
  MapPin,
  X,
  ArrowLeft,
} from 'lucide-react';
import PatientLayout from '../../components/patient/PatientLayout';
import { useActiveProfile } from '../../contexts/activeProfile';
import { getChatConversations, getChatMessages, sendChatMessage } from '../../api/chat';
import '../../styles/consultation-chat.css';

const PATIENT_QUICK_QUESTIONS = [
  'Doctor, should I take this medication before or after food?',
  'My blood pressure was 124/80 mmHg this morning.',
  'Can we review my latest lab test reports?',
  'Experiencing mild fatigue after starting the tablet.',
  'When should I schedule my next follow-up appointment?',
];

export default function PatientMessages() {
  const { activeProfile } = useActiveProfile();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const requestedDoctorId = searchParams.get('doctor') || '';

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load doctor conversations for patient
  const loadConversations = useCallback(async () => {
    try {
      const list = await getChatConversations('patient');
      setConversations(list);

      if (requestedDoctorId) {
        const found = list.find(
          (c) =>
            c.participant.id === requestedDoctorId ||
            c.participant.profileId === requestedDoctorId ||
            c.participant.id === '22222222-2222-4222-a222-222222222222'
        );
        if (found) {
          setActiveConv(found);
        } else if (!activeConv && list.length > 0) {
          setActiveConv(list[0]);
        }
      } else if (!activeConv && list.length > 0) {
        setActiveConv(list[0]);
      }
    } catch (err) {
      console.warn('[PatientMessages] loadConversations error:', err);
    } finally {
      setLoading(false);
    }
  }, [requestedDoctorId, activeConv]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages for active doctor
  const loadActiveMessages = useCallback(async () => {
    if (!activeConv) return;
    try {
      const msgs = await getChatMessages(activeConv.participant.id, 'patient');
      setMessages(msgs);
    } catch (err) {
      console.warn('[PatientMessages] loadActiveMessages error:', err);
    }
  }, [activeConv]);

  useEffect(() => {
    loadActiveMessages();
    const interval = setInterval(loadActiveMessages, 3000);
    return () => clearInterval(interval);
  }, [loadActiveMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send message to doctor
  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeConv || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      senderId: activeProfile.id,
      senderName: activeProfile.name || 'Atharv Kavitake',
      senderRole: 'patient',
      receiverId: activeConv.participant.id,
      text,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      await sendChatMessage({
        receiverId: activeConv.participant.id,
        text,
        senderRole: 'patient',
      });
      await loadActiveMessages();
      await loadConversations();
    } catch (err) {
      console.error('[PatientMessages] Send error:', err);
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.participant.name.toLowerCase().includes(q) ||
      (c.participant.speciality || '').toLowerCase().includes(q)
    );
  });

  const formatMsgTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      return new Intl.DateTimeFormat('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(timestamp));
    } catch {
      return '';
    }
  };

  return (
    <PatientLayout profile={activeProfile}>
      <div className="patient-content" style={{ padding: '16px 20px 30px' }}>
        <div style={{ marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 11, color: '#5b7279', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>
            Consultation Channel
          </p>
          <h2 style={{ margin: '2px 0 0', fontSize: 20, color: '#132c33', fontWeight: 700 }}>
            Doctor Consultation Chat
          </h2>
        </div>

        <div className="chat-container">
          {/* 1. Left Sidebar: Doctors List */}
          <aside className="chat-sidebar">
            <div className="chat-sidebar-header">
              <div className="chat-sidebar-title-row">
                <h2>
                  <Stethoscope size={17} />
                  <span>Your Doctors</span>
                </h2>
                <span className="chat-count-badge">{conversations.length}</span>
              </div>
              <div className="chat-search-wrap">
                <Search size={14} />
                <input
                  type="search"
                  className="chat-search-input"
                  placeholder="Search doctors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: 8,
                      background: 'transparent',
                      border: 'none',
                      color: '#71868e',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="chat-conversations-list">
              {filteredConversations.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#6a8087', fontSize: 12 }}>
                  No doctors found.
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isSelected = activeConv?.participant?.id === conv.participant.id;
                  const initials = conv.participant.name
                    ? conv.participant.name
                        .replace(/^Dr\.?\s*/i, '')
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                    : 'DR';

                  return (
                    <button
                      key={conv.participant.id}
                      type="button"
                      className={`chat-conv-item ${isSelected ? 'active' : ''}`}
                      onClick={() => setActiveConv(conv)}
                    >
                      <div className="chat-avatar-wrap">
                        <div className="chat-avatar">
                          <span>{initials}</span>
                        </div>
                        {conv.participant.online && <span className="chat-online-dot" />}
                      </div>

                      <div className="chat-conv-body">
                        <div className="chat-conv-name-row">
                          <span className="chat-conv-name">{conv.participant.name}</span>
                          <span className="chat-conv-time">{formatMsgTime(conv.lastMessage?.timestamp)}</span>
                        </div>
                        <div className="chat-conv-snippet-row">
                          <span className="chat-conv-snippet">{conv.participant.speciality} · {conv.lastMessage?.text || 'Active consultation'}</span>
                          {conv.unreadCount > 0 && (
                            <span className="chat-conv-unread">{conv.unreadCount}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* 2. Right Pane: Chat with Doctor */}
          <section className="chat-main-pane">
            {activeConv ? (
              <>
                {/* Header */}
                <header className="chat-main-header">
                  <div className="chat-main-user-info">
                    <div className="chat-avatar" style={{ width: 42, height: 42 }}>
                      <span>
                        {activeConv.participant.name
                          ?.replace(/^Dr\.?\s*/i, '')
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('') || 'DR'}
                      </span>
                    </div>
                    <div className="chat-main-user-details">
                      <h3>
                        <span>{activeConv.participant.name}</span>
                        <BadgeCheck size={16} style={{ color: '#167c74' }} />
                      </h3>
                      <p>
                        <span className="chat-status-indicator">● Verified Doctor</span>
                        <span>•</span>
                        <span>{activeConv.participant.speciality || 'Cardiology'}</span>
                        {activeConv.participant.clinic && (
                          <>
                            <span>•</span>
                            <span>{activeConv.participant.clinic}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="chat-main-actions">
                    <button
                      type="button"
                      className="btn-chat-action"
                      onClick={() =>
                        navigate(
                          `/patient/book-appointment/${activeConv.participant.profileId || activeConv.participant.id}`
                        )
                      }
                      title="Book appointment with this doctor"
                    >
                      <Calendar size={14} />
                      <span>Book Appointment</span>
                    </button>
                  </div>
                </header>

                {/* Messages Timeline */}
                <div className="chat-messages-area">
                  <div className="chat-date-separator">Verified Medical Consultation Channel</div>

                  {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#688087', fontSize: 13 }}>
                      <p>You are in a direct medical consultation chat with {activeConv.participant.name}.</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isPatient = msg.senderRole === 'patient';
                      return (
                        <div
                          key={msg.id}
                          className={`chat-msg-row ${isPatient ? 'outbound' : 'inbound'}`}
                        >
                          <div className="chat-msg-bubble">
                            <p className="chat-msg-text">{msg.text}</p>
                            <div className="chat-msg-meta">
                              <span>{formatMsgTime(msg.timestamp)}</span>
                              {isPatient && <CheckCheck size={13} style={{ color: '#a0eedd' }} />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Patient Question Chips */}
                <div className="chat-quick-templates">
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#566e75', textTransform: 'uppercase', marginRight: 4 }}>
                    Quick Questions:
                  </span>
                  {PATIENT_QUICK_QUESTIONS.map((tmpl) => (
                    <button
                      key={tmpl}
                      type="button"
                      className="chat-template-chip"
                      onClick={() => setInputText(tmpl)}
                    >
                      {tmpl}
                    </button>
                  ))}
                </div>

                {/* Input Form */}
                <form className="chat-input-form" onSubmit={handleSend}>
                  <input
                    type="text"
                    className="chat-input-field"
                    placeholder={`Ask a question or send a health update to ${activeConv.participant.name}...`}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn-chat-send"
                    disabled={!inputText.trim() || sending}
                  >
                    <Send size={15} />
                    <span>{sending ? 'Sending...' : 'Send'}</span>
                  </button>
                </form>
              </>
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#677f86' }}>
                <p>Select a doctor to start messaging.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </PatientLayout>
  );
}

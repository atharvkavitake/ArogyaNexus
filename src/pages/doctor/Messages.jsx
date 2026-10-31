import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  MessageCircle,
  Send,
  Search,
  FileText,
  Calendar,
  CheckCheck,
  Check,
  User,
  Sparkles,
  ArrowLeft,
  X,
  Stethoscope,
  Activity,
  Heart,
  Droplet,
} from 'lucide-react';
import DoctorSidebar from '../../components/doctor/DoctorSidebar';
import { getCurrentUser, logoutUser } from '../../services/auth/authService';
import { getChatConversations, getChatMessages, sendChatMessage } from '../../api/chat';
import '../../styles/dashboard.css';
import '../../styles/consultation-chat.css';

const QUICK_TEMPLATES = [
  'Please share your latest morning BP reading.',
  'Continue current medication dosage after meals.',
  'Your ECG and lab parameters look stable.',
  'Please avoid strenuous activity for the next 24 hours.',
  'Let us schedule a follow-up review for next week.',
];

export default function DoctorMessages() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedPatientId = searchParams.get('patient') || '';

  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const messagesEndRef = useRef(null);

  // Load doctor user profile
  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((curr) => {
        if (active) setUser(curr);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const effectiveUser = user || {
    id: '22222222-2222-4222-a222-222222222222',
    full_name: 'Dr. Ananya S. Sharma',
    role: 'doctor',
    doctor_profile: { status: 'approved', speciality: 'Cardiologist' },
  };

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const list = await getChatConversations('doctor');
      setConversations(list);

      // Select active conversation
      if (requestedPatientId) {
        const found = list.find(
          (c) =>
            c.participant.id === requestedPatientId ||
            c.participant.profileId === requestedPatientId
        );
        if (found) {
          setActiveConv(found);
        } else if (!activeConv) {
          // If requested patient not in list yet, create active entry
          const tempConv = {
            participant: {
              id: requestedPatientId,
              profileId: requestedPatientId,
              name: 'Sachin Shinde',
              age: 34,
              gender: 'Male',
              bloodGroup: 'B+',
              condition: 'Patient Consultation',
              online: true,
            },
            lastMessage: {
              text: 'Active patient consultation chat',
              timestamp: new Date().toISOString(),
              senderRole: 'doctor',
            },
            unreadCount: 0,
          };
          setActiveConv(tempConv);
        }
      } else if (!activeConv && list.length > 0) {
        setActiveConv(list[0]);
      }
    } catch (err) {
      console.warn('[DoctorMessages] loadConversations error:', err);
    } finally {
      setLoading(false);
    }
  }, [requestedPatientId, activeConv]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages for active conversation
  const loadActiveMessages = useCallback(async () => {
    if (!activeConv) return;
    try {
      const msgs = await getChatMessages(activeConv.participant.id, 'doctor');
      setMessages(msgs);
    } catch (err) {
      console.warn('[DoctorMessages] loadActiveMessages error:', err);
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

  // Send message
  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeConv || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic message update
    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      senderId: effectiveUser.id,
      senderName: effectiveUser.full_name,
      senderRole: 'doctor',
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
        senderRole: 'doctor',
      });
      await loadActiveMessages();
      await loadConversations();
    } catch (err) {
      console.error('[DoctorMessages] Send error:', err);
    } finally {
      setSending(false);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.participant.name.toLowerCase().includes(q) ||
      (c.participant.condition || '').toLowerCase().includes(q)
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
    <div className="doctor-dashboard">
      <DoctorSidebar
        user={effectiveUser}
        onLogout={() =>
          logoutUser()
            .then(() => navigate('/login'))
            .catch(() => undefined)
        }
      />

      <main className="doctor-workspace">
        <header className="doctor-topbar">
          <div className="doctor-appointments-title">
            <p>Doctor Workspace · Clinical Care</p>
            <h1>Patient Consultation Messages</h1>
          </div>
          <div className="doctor-top-actions">
            <button
              type="button"
              className="doctor-records-back-btn"
              onClick={() => navigate('/doctor/appointments')}
              style={{ fontSize: 12, padding: '6px 12px' }}
            >
              <Calendar size={14} />
              <span>Appointments</span>
            </button>
            <div className="doctor-profile">
              <span className="doctor-avatar">
                {effectiveUser.full_name?.replace(/^Dr\.\s*/i, '').charAt(0) || 'D'}
              </span>
              <span>
                <strong>{effectiveUser.full_name}</strong>
                <small>{effectiveUser.doctor_profile?.speciality || 'Cardiologist'}</small>
              </span>
            </div>
          </div>
        </header>

        <div className="chat-workspace">
          <div className="chat-container">
            {/* 1. Left Sidebar: Patient Conversations List */}
            <aside className="chat-sidebar">
              <div className="chat-sidebar-header">
                <div className="chat-sidebar-title-row">
                  <h2>
                    <MessageCircle size={17} />
                    <span>Active Patients</span>
                  </h2>
                  <span className="chat-count-badge">{conversations.length}</span>
                </div>
                <div className="chat-search-wrap">
                  <Search size={14} />
                  <input
                    type="search"
                    className="chat-search-input"
                    placeholder="Search patients..."
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
                    No conversations found.
                  </div>
                ) : (
                  filteredConversations.map((conv) => {
                    const isSelected = activeConv?.participant?.id === conv.participant.id;
                    const initials = conv.participant.name
                      ? conv.participant.name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                      : 'PT';

                    return (
                      <button
                        key={conv.participant.id}
                        type="button"
                        className={`chat-conv-item ${isSelected ? 'active' : ''}`}
                        onClick={() => setActiveConv(conv)}
                      >
                        <div className="chat-avatar-wrap">
                          <div className="chat-avatar">
                            {conv.participant.photoUrl ? (
                              <img src={conv.participant.photoUrl} alt="" />
                            ) : (
                              <span>{initials}</span>
                            )}
                          </div>
                          {conv.participant.online && <span className="chat-online-dot" />}
                        </div>

                        <div className="chat-conv-body">
                          <div className="chat-conv-name-row">
                            <span className="chat-conv-name">{conv.participant.name}</span>
                            <span className="chat-conv-time">{formatMsgTime(conv.lastMessage?.timestamp)}</span>
                          </div>
                          <div className="chat-conv-snippet-row">
                            <span className="chat-conv-snippet">{conv.lastMessage?.text || 'No messages yet'}</span>
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

            {/* 2. Right Pane: Active Conversation */}
            <section className="chat-main-pane">
              {activeConv ? (
                <>
                  {/* Header */}
                  <header className="chat-main-header">
                    <div className="chat-main-user-info">
                      <div className="chat-avatar" style={{ width: 42, height: 42 }}>
                        {activeConv.participant.photoUrl ? (
                          <img src={activeConv.participant.photoUrl} alt="" />
                        ) : (
                          <span>
                            {activeConv.participant.name
                              ?.split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('') || 'PT'}
                          </span>
                        )}
                      </div>
                      <div className="chat-main-user-details">
                        <h3>
                          <span>{activeConv.participant.name}</span>
                          {activeConv.participant.bloodGroup && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: '#ffebee',
                                color: '#c62828',
                              }}
                            >
                              {activeConv.participant.bloodGroup}
                            </span>
                          )}
                        </h3>
                        <p>
                          <span className="chat-status-indicator">● Active Consultation</span>
                          <span>•</span>
                          <span>{activeConv.participant.age || 34} yrs · {activeConv.participant.gender || 'Male'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="chat-main-actions">
                      <button
                        type="button"
                        className="btn-chat-action"
                        onClick={() =>
                          navigate(
                            `/doctor/records/${activeConv.participant.profileId || activeConv.participant.id}`
                          )
                        }
                        title="View patient's health records & vitals"
                      >
                        <FileText size={14} />
                        <span>Medical Records</span>
                      </button>
                      <button
                        type="button"
                        className="btn-chat-action"
                        onClick={() => navigate('/doctor/appointments')}
                        title="View appointment schedule"
                      >
                        <Calendar size={14} />
                        <span>Appointments</span>
                      </button>
                    </div>
                  </header>

                  {/* Messages Area */}
                  <div className="chat-messages-area">
                    <div className="chat-date-separator">Today • Consultation Channel</div>

                    {messages.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#688087', fontSize: 13 }}>
                        <p>Start a direct consultation message with {activeConv.participant.name}.</p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isDoctor = msg.senderRole === 'doctor';
                        return (
                          <div
                            key={msg.id}
                            className={`chat-msg-row ${isDoctor ? 'outbound' : 'inbound'}`}
                          >
                            <div className="chat-msg-bubble">
                              <p className="chat-msg-text">{msg.text}</p>
                              <div className="chat-msg-meta">
                                <span>{formatMsgTime(msg.timestamp)}</span>
                                {isDoctor && <CheckCheck size={13} style={{ color: '#a0eedd' }} />}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Quick Clinical Response Templates */}
                  <div className="chat-quick-templates">
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#566e75', textTransform: 'uppercase', marginRight: 4 }}>
                      Quick Templates:
                    </span>
                    {QUICK_TEMPLATES.map((tmpl) => (
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
                      placeholder={`Send a medical message to ${activeConv.participant.name}...`}
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
                  <p>Select a patient conversation to begin messaging.</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

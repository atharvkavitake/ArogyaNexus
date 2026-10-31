/**
 * ArogyaNexus — Consultation Chat API Client
 */

export async function getChatConversations(role = 'doctor') {
  try {
    const res = await fetch(`/api/chat/conversations?role=${encodeURIComponent(role)}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return data.conversations || [];
    }
    return [];
  } catch (err) {
    console.warn('[ChatAPI] getChatConversations error:', err);
    return [];
  }
}

export async function getChatMessages(participantId, role = 'doctor') {
  try {
    const res = await fetch(`/api/chat/messages?participantId=${encodeURIComponent(participantId)}&role=${encodeURIComponent(role)}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return data.messages || [];
    }
    return [];
  } catch (err) {
    console.warn('[ChatAPI] getChatMessages error:', err);
    return [];
  }
}

export async function sendChatMessage({ receiverId, text, senderRole = 'doctor' }) {
  try {
    const res = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ receiverId, text, senderRole }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return data.message;
    }
    throw new Error(data.error || 'Could not send message.');
  } catch (err) {
    console.error('[ChatAPI] sendChatMessage error:', err);
    throw err;
  }
}

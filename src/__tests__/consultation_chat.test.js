import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getChatConversations, getChatMessages, sendChatMessage } from '../api/chat';

describe('Consultation Chat API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches conversations for doctor role successfully', async () => {
    const mockConversations = [
      { id: 'p1', name: 'Rahul Sharma', unread: 2, lastMessage: 'BP reading is 138/88' }
    ];
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, conversations: mockConversations })
    });

    const result = await getChatConversations('doctor');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Rahul Sharma');
    expect(global.fetch).toHaveBeenCalledWith('/api/chat/conversations?role=doctor', expect.any(Object));
  });

  it('fetches messages for a participant', async () => {
    const mockMessages = [
      { id: 'm1', senderRole: 'patient', text: 'Hello doctor' },
      { id: 'm2', senderRole: 'doctor', text: 'Hello, how can I help you today?' }
    ];
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, messages: mockMessages })
    });

    const result = await getChatMessages('p1', 'doctor');
    expect(result).toHaveLength(2);
    expect(result[1].text).toContain('how can I help');
    expect(global.fetch).toHaveBeenCalledWith('/api/chat/messages?participantId=p1&role=doctor', expect.any(Object));
  });

  it('posts a new chat message and returns sent item', async () => {
    const mockMessage = {
      id: 'm3',
      receiverId: 'p1',
      senderRole: 'doctor',
      text: 'Please continue Telmisartan 40mg.'
    };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: mockMessage })
    });

    const result = await sendChatMessage({
      receiverId: 'p1',
      text: 'Please continue Telmisartan 40mg.',
      senderRole: 'doctor'
    });
    expect(result.id).toBe('m3');
    expect(result.text).toBe('Please continue Telmisartan 40mg.');
  });
});

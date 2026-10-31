/**
 * Gemini API Multi-Key Manager
 * Provides automatic fallback, rotation, and quota-exhaustion failover across multiple API keys.
 * If Key 1 reaches its limit, Key 2 is automatically called, then Key 3, and so on.
 */

export interface KeyExecutionResult<T> {
  result: T;
  keyIndex: number;
  totalKeys: number;
  maskedKey: string;
}

export interface KeyStats {
  keyIndex: number;
  maskedKey: string;
  isCoolingDown: boolean;
  cooldownUntil?: number;
  totalAttempts: number;
  successCount: number;
  quotaFailures: number;
}

// In-memory cooldown tracking per key (in milliseconds)
// If a key hits 429/quota limit, it will be placed on cooldown (default: 60 seconds)
const keyCooldowns = new Map<string, number>();
const keyStatsMap = new Map<string, { attempts: number; success: number; quotaErrors: number }>();
const DEFAULT_COOLDOWN_MS = 60 * 1000;

export function maskApiKey(key: string): string {
  if (!key) return '(empty)';
  if (key.length <= 12) return '***';
  return `${key.slice(0, 10)}...${key.slice(-4)}`;
}

/**
 * Collects and deduplicates all configured Gemini API keys from environment variables and explicit inputs.
 * Order of priority:
 * 1. Explicit key(s) provided in request/call
 * 2. GEMINI_API_KEY (Key 1)
 * 3. GEMINI_API_KEY_2 (Key 2)
 * 4. GEMINI_API_KEY_3 (Key 3)
 * 5. GEMINI_API_KEY_4, GEMINI_API_KEY_5
 * 6. GEMINI_API_KEYS (comma or space separated list)
 * 7. GOOGLE_API_KEY, GOOGLE_API_KEY_2, GOOGLE_API_KEY_3
 */
export function getGeminiApiKeys(explicitKey?: string | string[]): string[] {
  const keys: string[] = [];

  const addKeys = (raw?: string | string[] | null) => {
    if (!raw) return;
    if (Array.isArray(raw)) {
      for (const k of raw) addKeys(k);
      return;
    }
    const parts = raw.split(/[,;\s]+/).map((k) => k.trim()).filter(Boolean);
    keys.push(...parts);
  };

  // 1. Explicit keys from caller
  addKeys(explicitKey);

  // 2. Numbered GEMINI_API_KEYs
  if (process.env.GEMINI_API_KEY) addKeys(process.env.GEMINI_API_KEY);
  if (process.env.GEMINI_API_KEY_1) addKeys(process.env.GEMINI_API_KEY_1);
  if (process.env.GEMINI_API_KEY_2) addKeys(process.env.GEMINI_API_KEY_2);
  if (process.env.GEMINI_API_KEY_3) addKeys(process.env.GEMINI_API_KEY_3);
  if (process.env.GEMINI_API_KEY_4) addKeys(process.env.GEMINI_API_KEY_4);
  if (process.env.GEMINI_API_KEY_5) addKeys(process.env.GEMINI_API_KEY_5);

  // 3. Comma-separated list
  if (process.env.GEMINI_API_KEYS) addKeys(process.env.GEMINI_API_KEYS);

  // 4. GOOGLE_API_KEY fallbacks
  if (process.env.GOOGLE_API_KEY) addKeys(process.env.GOOGLE_API_KEY);
  if (process.env.GOOGLE_API_KEY_2) addKeys(process.env.GOOGLE_API_KEY_2);
  if (process.env.GOOGLE_API_KEY_3) addKeys(process.env.GOOGLE_API_KEY_3);

  // Deduplicate preserving order
  const uniqueKeys = Array.from(new Set(keys)).filter((k) => k && !k.includes('your_gemini_api_key'));
  return uniqueKeys;
}

/**
 * Checks whether an error is due to rate limiting or quota exhaustion
 */
export function isQuotaOrRateLimitError(error: any): boolean {
  if (!error) return false;
  if (error.isQuotaExceeded === true) return true;

  const msg = String(error?.message || error || '').toLowerCase();
  const status = error.status || (error.code ? Number(error.code) : null);

  return (
    status === 429 ||
    status === 403 ||
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('limit reached') ||
    msg.includes('exceeded your current quota') ||
    msg.includes('capacity')
  );
}

/**
 * Mark a key in cooldown when it encounters quota exhaustion
 */
export function markKeyCooldown(key: string, durationMs: number = DEFAULT_COOLDOWN_MS): void {
  const until = Date.now() + durationMs;
  keyCooldowns.set(key, until);
}

/**
 * Check if a key is currently in cooldown
 */
export function isKeyInCooldown(key: string): boolean {
  const until = keyCooldowns.get(key);
  if (!until) return false;
  if (Date.now() >= until) {
    keyCooldowns.delete(key);
    return false;
  }
  return true;
}

/**
 * Execute an operation with automatic fallback through available API keys.
 * If key 1 reaches its limit or fails, key 2 is automatically called; if key 2 reaches its limit, key 3 is called.
 */
export async function executeWithKeyFallback<T>(
  operation: (apiKey: string, keyIndex: number, totalKeys: number) => Promise<T>,
  options: { explicitKey?: string | string[]; operationName?: string } = {}
): Promise<KeyExecutionResult<T>> {
  const allKeys = getGeminiApiKeys(options.explicitKey);
  const opName = options.operationName || 'Gemini AI Operation';

  if (allKeys.length === 0) {
    throw new Error('No Gemini API keys found. Please configure GEMINI_API_KEY, GEMINI_API_KEY_2, etc.');
  }

  // Sort keys: keys not in cooldown come first; keys in cooldown serve as fallback
  const sortedKeys = [...allKeys].sort((a, b) => {
    const aCool = isKeyInCooldown(a) ? 1 : 0;
    const bCool = isKeyInCooldown(b) ? 1 : 0;
    return aCool - bCool;
  });

  const errors: Array<{ keyIndex: number; maskedKey: string; error: string; isQuota: boolean }> = [];

  for (let i = 0; i < sortedKeys.length; i++) {
    const currentKey = sortedKeys[i];
    const keyIndex = allKeys.indexOf(currentKey);
    const masked = maskApiKey(currentKey);

    const stats = keyStatsMap.get(currentKey) || { attempts: 0, success: 0, quotaErrors: 0 };
    stats.attempts++;
    keyStatsMap.set(currentKey, stats);

    console.log(`[GeminiKeyManager] [${opName}] Attempting with Key #${keyIndex + 1}/${allKeys.length} (${masked})...`);

    try {
      const result = await operation(currentKey, keyIndex, allKeys.length);
      stats.success++;
      keyStatsMap.set(currentKey, stats);
      keyCooldowns.delete(currentKey); // Clear cooldown on success

      console.log(`[GeminiKeyManager] [${opName}] Succeeded with Key #${keyIndex + 1} (${masked}).`);
      return {
        result,
        keyIndex,
        totalKeys: allKeys.length,
        maskedKey: masked,
      };
    } catch (err: any) {
      const isQuota = isQuotaOrRateLimitError(err);
      if (isQuota) {
        stats.quotaErrors++;
        keyStatsMap.set(currentKey, stats);
        markKeyCooldown(currentKey);
        console.warn(
          `[GeminiKeyManager] [${opName}] Key #${keyIndex + 1} (${masked}) reached quota/rate limit: "${err.message}".`
        );
      } else {
        console.warn(
          `[GeminiKeyManager] [${opName}] Key #${keyIndex + 1} (${masked}) failed: "${err.message}".`
        );
      }

      errors.push({
        keyIndex: keyIndex + 1,
        maskedKey: masked,
        error: err.message || String(err),
        isQuota,
      });

      if (i < sortedKeys.length - 1) {
        const nextKey = sortedKeys[i + 1];
        const nextIdx = allKeys.indexOf(nextKey);
        console.log(`[GeminiKeyManager] [${opName}] Automatically falling back to Key #${nextIdx + 1} (${maskApiKey(nextKey)})...`);
      }
    }
  }

  // If all keys failed, formulate comprehensive aggregate error
  const summaryErrors = errors
    .map((e) => `Key #${e.keyIndex} (${e.maskedKey}): ${e.isQuota ? '[QUOTA EXCEEDED]' : '[ERROR]'} ${e.error}`)
    .join('; ');

  const aggregateError: any = new Error(
    `All ${allKeys.length} Gemini API keys failed or exceeded quotas. Details: ${summaryErrors}`
  );
  aggregateError.keyErrors = errors;
  aggregateError.allExhausted = true;
  throw aggregateError;
}

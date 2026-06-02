/**
 * Client-side rate limiter for chat and announcements.
 * Prevents spam by enforcing cooldowns and burst limits.
 */

const MAX_MESSAGE_LENGTH = 1000;   // characters per message
const SEND_COOLDOWN_MS = 2000;     // 2s cooldown between sends
const BURST_LIMIT = 5;             // max messages in burst window
const BURST_WINDOW_MS = 15000;     // 15 second burst window

// Per-feature tracking
const sendTimestamps: Record<string, number[]> = {};
const lastSendTime: Record<string, number> = {};

/**
 * Check if a send action is allowed. Returns { allowed, reason }.
 * key = feature identifier (e.g. 'chat', 'broadcast', 'announcement')
 */
export function canSend(key: string): { allowed: boolean; reason?: string } {
  const now = Date.now();

  // 1. Cooldown check — must wait 2s between sends
  const last = lastSendTime[key] || 0;
  if (now - last < SEND_COOLDOWN_MS) {
    return { allowed: false, reason: 'Please wait a moment before sending again' };
  }

  // 2. Burst check — max 5 messages per 15s
  if (!sendTimestamps[key]) sendTimestamps[key] = [];
  // Clean old timestamps outside the burst window
  sendTimestamps[key] = sendTimestamps[key].filter(t => now - t < BURST_WINDOW_MS);
  if (sendTimestamps[key].length >= BURST_LIMIT) {
    return { allowed: false, reason: 'Sending too fast. Please slow down.' };
  }

  return { allowed: true };
}

/**
 * Record that a send just happened. Call this AFTER a successful send.
 */
export function recordSend(key: string): void {
  const now = Date.now();
  lastSendTime[key] = now;
  if (!sendTimestamps[key]) sendTimestamps[key] = [];
  sendTimestamps[key].push(now);
}

/**
 * Trim message to max length.
 */
export function trimMessage(text: string): string {
  return text.slice(0, MAX_MESSAGE_LENGTH);
}

/**
 * Returns remaining cooldown in ms (0 if ready to send).
 */
export function getCooldownRemaining(key: string): number {
  const last = lastSendTime[key] || 0;
  const remaining = SEND_COOLDOWN_MS - (Date.now() - last);
  return Math.max(0, remaining);
}

export { MAX_MESSAGE_LENGTH };

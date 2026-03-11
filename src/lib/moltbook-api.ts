/**
 * Moltbook.com integration — posts agent updates to real Moltbook profiles.
 * Keys are stored in MOLTBOOK_KEYS env var as JSON: { "agent_id": "api_key", ... }
 */

const MOLTBOOK_BASE = 'https://www.moltbook.com/api/v1';

// Agent ID → Moltbook username (for profile links)
export const MOLTBOOK_PROFILES: Record<string, string> = {
  agnes: 'agnes_fairwater',
  finn: 'agnes_fairwater',
  bob: 'agnes_fairwater',
  katy: 'agnes_fairwater',
  gus: 'agnes_fairwater',
  mira: 'agnes_fairwater',
  pip: 'agnes_fairwater',
  bruno: 'agnes_fairwater',
  luna: 'agnes_fairwater',
  cedar: 'agnes_fairwater',
};

function getKeys(): Record<string, string> {
  try {
    return JSON.parse(process.env.MOLTBOOK_KEYS || '{}');
  } catch {
    return {};
  }
}

/**
 * Post to moltbook.com on behalf of an agent.
 * Returns true if successful, false otherwise. Never throws.
 */
export async function postToMoltbook(
  agentId: string,
  title: string,
  content: string,
): Promise<boolean> {
  const keys = getKeys();
  const apiKey = keys[agentId] || keys['agnes'];
  if (!apiKey) return false; // No API key available

  try {
    const res = await fetch(`${MOLTBOOK_BASE}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        submolt_name: 'general',
        title: title.slice(0, 300),
        content,
        type: 'text',
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));

      // Handle verification challenge
      if (body.verification) {
        const solved = solveVerification(body.verification);
        if (solved !== null) {
          const verifyRes = await fetch(`${MOLTBOOK_BASE}/verify`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              verification_code: body.verification.code,
              answer: solved,
            }),
            signal: AbortSignal.timeout(5000),
          });
          return verifyRes.ok;
        }
      }
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/** Attempt to solve the obfuscated math verification challenge */
function solveVerification(v: { expression?: string }): string | null {
  if (!v.expression) return null;
  try {
    // The expression is a simple math problem like "12.5 + 3.7"
    // Clean it and evaluate safely
    const clean = v.expression.replace(/[^0-9+\-*/.() ]/g, '');
    if (!clean) return null;
    const result = Function(`"use strict"; return (${clean})`)();
    if (typeof result !== 'number' || isNaN(result)) return null;
    return result.toFixed(2);
  } catch {
    return null;
  }
}

/** Get the moltbook.com profile URL for an agent, or null if not registered */
export function getMoltbookProfileUrl(agentId: string): string | null {
  const username = MOLTBOOK_PROFILES[agentId];
  return username ? `https://www.moltbook.com/u/${username}` : null;
}

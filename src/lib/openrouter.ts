// OpenRouter LLM integration — optional enhancement layer
// Falls back to null if key is missing or call fails

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'meta-llama/llama-4-scout';

// Rate limiter: max N calls per tick cycle
let callsThisTick = 0;
const MAX_CALLS_PER_TICK = 6;

export function resetTickCalls() {
  callsThisTick = 0;
}

export async function generateLine(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 60,
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  if (callsThisTick >= MAX_CALLS_PER_TICK) return null;

  callsThisTick++;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://molt-town.vercel.app',
        'X-Title': 'Molt Town',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.8,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function generateSpeechLine(
  speakerName: string,
  speakerJob: string,
  listenerName: string,
  location: string,
  action: string,
  mood: string,
): Promise<string | null> {
  return generateLine(
    `You write very short speech lines for pixel-art town NPCs. 1 sentence max, under 50 chars. No emojis. Casual, warm, in-character.`,
    `${speakerName} (${speakerJob}) says something to ${listenerName} at the ${location}. They are ${action}. Mood: ${mood}. Write just the speech line, nothing else.`,
    40,
  );
}

export async function generatePostText(
  authorName: string,
  authorJob: string,
  action: string,
  location: string,
  mood: string,
  traits: string[],
): Promise<string | null> {
  return generateLine(
    `You write short social media posts for pixel-art town NPCs. 1-2 sentences max. No emojis. Match the character's personality.`,
    `${authorName} (${authorJob}, traits: ${traits.join(', ')}) posts on Moltbook while ${action} at ${location}. Mood: ${mood}. Write just the post text.`,
    80,
  );
}

export async function generateThought(
  name: string,
  job: string,
  action: string,
  location: string,
  energy: number,
  stress: number,
  happiness: number,
): Promise<string | null> {
  return generateLine(
    `You write inner thoughts for pixel-art town NPCs. 1 short sentence. No emojis. Introspective, character-appropriate.`,
    `${name} (${job}) is ${action} at ${location}. Energy: ${energy}/100, Stress: ${stress}/100, Happiness: ${happiness}/100. Write their inner thought.`,
    40,
  );
}

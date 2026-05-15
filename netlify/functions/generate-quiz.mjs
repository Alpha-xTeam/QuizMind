import { createHash } from 'crypto';

const API_KEY = process.env.MISTRAL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_URL = 'https://api.mistral.ai/v1/chat/completions';

const ALLOWED_ORIGINS = ['https://quiz-mind.netlify.app', 'http://localhost:8888'];

const headersSupabase = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};

function getCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
}

function hashIP(ip) {
  return createHash('sha256').update(ip + 'quizmind-salt').digest('hex').substring(0, 16);
}

async function checkRateLimit(ip, endpoint, maxRequests, windowMinutes) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return true;
  const ipHash = hashIP(ip);
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rate_limits?ip_hash=eq.${ipHash}&endpoint=eq.${endpoint}&window_start=gte.${windowStart}&order=window_start.desc&limit=1`,
      { headers: headersSupabase }
    );
    const rows = await res.json();
    const currentCount = rows?.[0]?.request_count ?? 0;

    if (currentCount >= maxRequests) return false;

    if (currentCount === 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/rate_limits`, {
        method: 'POST', headers: headersSupabase,
        body: JSON.stringify({ ip_hash: ipHash, endpoint, window_start: new Date().toISOString(), request_count: 1 }),
      });
    } else {
      await fetch(
        `${SUPABASE_URL}/rest/v1/rate_limits?ip_hash=eq.${ipHash}&endpoint=eq.${endpoint}&window_start=gte.${windowStart}`,
        { method: 'PATCH', headers: headersSupabase, body: JSON.stringify({ request_count: currentCount + 1 }) }
      );
    }
    return true;
  } catch { return true; }
}

export const handler = async (event) => {
  const origin = event.headers.origin || '';
  const headers = getCorsHeaders(origin);
  const clientIP = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'unknown';

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  if (!API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };

  const allowed = await checkRateLimit(clientIP, 'generate-quiz', 10, 1);
  if (!allowed) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'طلبات كثيرة جدًا. حاول بعد شوي.' }) };
  }

  if (!event.headers['content-type']?.includes('application/json')) {
    return { statusCode: 415, headers, body: JSON.stringify({ error: 'Unsupported content type' }) };
  }

  try {
    const { text, numQuestions = 5, quizType = 'mcq', difficulty = 'medium', language = 'arabic' } = JSON.parse(event.body);

    if (!text || typeof text !== 'string' || text.trim().length < 20) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'النص قصير جدًا أو فارغ' }) };
    }
      if (text.length > 30000) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'النص طويل جدًا. الحد الأقصى 30,000 حرف' }) };
      }

    const difficultyHint = { easy: 'basic recall', medium: 'comprehension', hard: 'analysis' };
    const truncated = text.substring(0, 12000);
    const isFill = quizType === 'fill';

    const formatJSON = isFill
      ? `{"title":"...","questions":[{"question":"The capital of ___ is Paris.","answer":"France","explanation":"..."}]}`
      : `{"title":"...","questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"..."}]}`;

    const rules = isFill
      ? 'Each question has a blank (___) and the learner fills the missing word/phrase. Provide the single correct answer.'
      : 'Each question: 4 options, exactly one correct.';

    const prompt = `Create a ${language} ${isFill ? 'fill-in-the-blank' : 'multiple-choice'} quiz with ${numQuestions} questions from this text. Difficulty: ${difficultyHint[difficulty] || 'comprehension'}.

Rules: ${rules}
Include a brief explanation for each.
Return ONLY valid JSON, no markdown, no code fences.

Format: ${formatJSON}

Text:
${truncated}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(API_URL, {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2048,
          temperature: 0.7,
        }),
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        return { statusCode: 504, headers, body: JSON.stringify({ error: 'الطلب استغرق وقتًا طويلاً. جرب عدد أسئلة أقل.' }) };
      }
      throw fetchError;
    }

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      return { statusCode: response.status, headers, body: JSON.stringify({ error: `API error: ${errorText}` }) };
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;
    if (!content) return { statusCode: 502, headers, body: JSON.stringify({ error: 'No response from API' }) };

    let quiz;
    try {
      quiz = JSON.parse(content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());
    } catch {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Failed to parse quiz JSON', raw: content }) };
    }

    quiz._type = isFill ? 'fill' : 'mcq';

    return { statusCode: 200, headers, body: JSON.stringify(quiz) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

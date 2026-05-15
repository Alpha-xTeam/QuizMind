import { createHash } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
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
        method: 'POST',
        headers: headersSupabase,
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
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  try {
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);

      if (body.action === 'increment_stats') {
        const allowed = await checkRateLimit(clientIP, 'increment-stats', 30, 1);
        if (!allowed) return { statusCode: 429, headers, body: JSON.stringify({ error: 'طلبات كثيرة' }) };

        const getRes = await fetch(`${SUPABASE_URL}/rest/v1/app_stats?id=eq.global`, { headers: headersSupabase });
        const existing = await getRes.json();
        const totalExams = (existing?.[0]?.total_exams ?? 0) + 1;

        await fetch(`${SUPABASE_URL}/rest/v1/app_stats?id=eq.global`, {
          method: 'PATCH',
          headers: headersSupabase,
          body: JSON.stringify({ total_exams: totalExams, updated_at: new Date().toISOString() }),
        });

        return { statusCode: 200, headers, body: JSON.stringify({ total_exams: totalExams }) };
      }

      const { title, difficulty, language, quiz_type, total_questions, correct_answers, score, answers_data } = body;
      if (!total_questions || correct_answers === undefined || score === undefined) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
      }

      const allowed = await checkRateLimit(clientIP, 'save-result', 20, 1);
      if (!allowed) return { statusCode: 429, headers, body: JSON.stringify({ error: 'طلبات كثيرة' }) };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/quiz_results`, {
        method: 'POST',
        headers: headersSupabase,
        body: JSON.stringify({
          title: title || 'امتحان',
          difficulty: difficulty || 'medium',
          language: language || 'arabic',
          quiz_type: quiz_type || 'mcq',
          total_questions,
          correct_answers,
          score,
          answers_data: answers_data || null,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return { statusCode: res.status, headers, body: JSON.stringify({ error: err }) };
      }

      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'GET') {
      const type = event.queryStringParameters?.type;

      if (type === 'stats') {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/app_stats?id=eq.global`, { headers: headersSupabase });
        const data = await res.json();
        return { statusCode: 200, headers, body: JSON.stringify({ total_exams: data?.[0]?.total_exams ?? 0 }) };
      }

      const limit = Math.min(parseInt(event.queryStringParameters?.limit) || 50, 100);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/quiz_results?order=created_at.desc&limit=${limit}`, { headers: headersSupabase });

      if (!res.ok) {
        const err = await res.text();
        return { statusCode: res.status, headers, body: JSON.stringify({ error: err }) };
      }

      return { statusCode: 200, headers, body: JSON.stringify(await res.json()) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

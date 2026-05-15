const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Content-Type': 'application/json',
};

const headersSupabase = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  try {
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);

      if (body.action === 'increment_stats') {
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
        const totalExams = data?.[0]?.total_exams ?? 0;
        return { statusCode: 200, headers, body: JSON.stringify({ total_exams: totalExams }) };
      }

      const limit = parseInt(event.queryStringParameters?.limit) || 50;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/quiz_results?order=created_at.desc&limit=${limit}`, { headers: headersSupabase });

      if (!res.ok) {
        const err = await res.text();
        return { statusCode: res.status, headers, body: JSON.stringify({ error: err }) };
      }

      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

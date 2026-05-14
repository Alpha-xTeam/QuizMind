const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  if (!MISTRAL_API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  if (!event.body || event.body.length > 500000) return { statusCode: 413, headers, body: JSON.stringify({ error: 'Request too large' }) };

  const contentType = event.headers['content-type'] || '';
  if (!contentType.includes('application/json')) return { statusCode: 415, headers, body: JSON.stringify({ error: 'Unsupported content type' }) };

  try {
    const { text, numQuestions = 5, difficulty = 'medium', language = 'arabic' } = JSON.parse(event.body);

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid or empty text' }) };
    }
    if (text.length > 50000) return { statusCode: 413, headers, body: JSON.stringify({ error: 'Text too large' }) };

    const difficultyHint = { easy: 'basic recall', medium: 'comprehension', hard: 'analysis' };
    const truncated = text.substring(0, 5000);

    const prompt = `Create a ${language} quiz with ${numQuestions} MCQs from this text. Difficulty: ${difficultyHint[difficulty] || 'comprehension'}. Each question: 4 options, one correct. Return JSON only: {"title":"...","questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"..."}]}\n\n${truncated}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let response;
    try {
      response = await fetch(MISTRAL_API_URL, {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MISTRAL_API_KEY}` },
        body: JSON.stringify({
          model: 'mistral-tiny-latest',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1024,
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
      return { statusCode: response.status, headers, body: JSON.stringify({ error: `Mistral API error: ${errorText}` }) };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { statusCode: 502, headers, body: JSON.stringify({ error: 'No response from Mistral' }) };

    let quiz;
    try {
      quiz = JSON.parse(content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());
    } catch {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Failed to parse quiz JSON', raw: content }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify(quiz) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

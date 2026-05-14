const API_KEY = process.env.MISTRAL_API_KEY;
const API_URL = 'https://api.mistral.ai/v1/chat/completions';

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  if (!API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };

  const contentType = event.headers['content-type'] || '';
  if (!contentType.includes('application/json')) return { statusCode: 415, headers, body: JSON.stringify({ error: 'Unsupported content type' }) };

  try {
    const { text, numQuestions = 5, difficulty = 'medium', language = 'arabic' } = JSON.parse(event.body);

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid or empty text' }) };
    }

    const difficultyHint = { easy: 'basic recall', medium: 'comprehension', hard: 'analysis' };
    const truncated = text.substring(0, 12000);

    const prompt = `Create a ${language} quiz with ${numQuestions} multiple-choice questions from this text. Difficulty: ${difficultyHint[difficulty] || 'comprehension'}.

    Rules:
    - Each question: 4 options, exactly one correct
    - Include a brief explanation
    - Return ONLY valid JSON, no markdown, no code fences

    Format: {"title":"...","questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"..."}]}

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

    return { statusCode: 200, headers, body: JSON.stringify(quiz) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

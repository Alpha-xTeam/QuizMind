const API_KEY = process.env.NVIDIA_API_KEY;
const API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

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
    const truncated = text.substring(0, 8000);

    const prompt = `Create a ${language} quiz with ${numQuestions} multiple-choice questions from this lecture text. Difficulty: ${difficultyHint[difficulty] || 'comprehension'}.

Each question must have exactly 4 options with one correct answer. Include a brief explanation.

Return ONLY valid JSON (no markdown, no code fences, no thinking tags) with this structure:
{"title":"Quiz title","questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"..."}]}

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
          model: 'google/gemma-4-31b-it',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096,
          temperature: 1.00,
          top_p: 0.95,
          chat_template_kwargs: { enable_thinking: true },
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

    // Strip thinking tags (Gemma 4 with enable_thinking wraps reasoning in <｜end▁of▁thinking｜> ...)
    content = content.replace(/[\s\S]*?<\/think>/g, '').trim();

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

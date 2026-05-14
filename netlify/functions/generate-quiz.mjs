const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

const TIMEOUT_MS = 7000; // 7s — stay under Netlify free tier 10s limit

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!MISTRAL_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  if (!event.body || event.body.length > 500000) {
    return { statusCode: 413, headers, body: JSON.stringify({ error: 'Request too large' }) };
  }

  const contentType = event.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    return { statusCode: 415, headers, body: JSON.stringify({ error: 'Unsupported content type' }) };
  }

  try {
    const { text, numQuestions = 5, difficulty = 'medium', language = 'arabic' } = JSON.parse(event.body);

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid or empty text' }) };
    }

    if (text.length > 50000) {
      return { statusCode: 413, headers, body: JSON.stringify({ error: 'Text too large' }) };
    }

    if (/[\x00-\x08\x0E-\x1F]/.test(text)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid content' }) };
    }

    const difficultyGuide = {
      easy: 'Ask basic recall questions: direct definitions, simple facts, and obvious concepts from the text. Options should have one clearly correct answer with the rest being noticeably wrong. Keep wording simple.',
      medium: 'Ask comprehension questions: require understanding of the material, ability to explain concepts in own words, and connect related ideas. Options should be plausible but distinguishable.',
      hard: 'Ask analysis and application questions: require critical thinking, synthesizing multiple concepts, applying knowledge to new scenarios, and evaluating ideas. Options should be tricky and closely related.',
    };

    const maxInput = 12000;
    const truncated = text.substring(0, maxInput);

    const prompt = `You are a quiz generator. Based on the following lecture content, create a quiz with exactly ${numQuestions} multiple-choice questions.

Each question must have 4 options with exactly one correct answer.

Return ONLY valid JSON (no markdown, no code fences, no extra text) with this exact structure:
{
  "title": "Quiz title based on the lecture topic",
  "questions": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation why this is correct"
    }
  ]
}

Difficulty level: ${difficulty}
Difficulty instructions: ${difficultyGuide[difficulty] || difficultyGuide.medium}
Language: ${language}
Lecture content:
${truncated}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response;
    try {
      response = await fetch(MISTRAL_API_URL, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [
            { role: 'system', content: 'You are a quiz generator that outputs only valid JSON.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 2048,
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

    if (!content) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'No response content from Mistral' }) };
    }

    let quiz;
    try {
      const cleaned = content
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      quiz = JSON.parse(cleaned);
    } catch {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Failed to parse quiz JSON from AI response', raw: content }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify(quiz) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

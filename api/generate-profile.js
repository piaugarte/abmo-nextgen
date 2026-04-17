
// ============================================================
// /api/generate-profile.js — Vercel Serverless Function
// ============================================================
// Takes questionnaire answers and generates a profile structured
// to match the Aboitiz-Moraza Gazette layout:
//   - tagline (one-line italic dek under the title)
//   - role (e.g. "Founder", "Owner & Operator")
//   - location (city, country)
//   - three Q&A cards: Origin Story, Speed Round, Lessons & Advice
//
// Each card contains Q&A pairs with lightly edited answers
// (grammar, flow) that preserve the owner's voice.
//
// Env var needed on Vercel:
//   ANTHROPIC_API_KEY
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { answers = {}, business_name = '', owner_name = '' } = req.body || {};

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY env var' });
  }

  // The question prompts that appeared in the questionnaire — we reuse them
  // so the AI knows what question goes with what answer.
  const Q_LABELS = {
    intro: "Can you briefly introduce yourself and your business?",
    inspiration: "What inspired you to start this venture, and how did your family influence that journey?",
    purpose: "What is this business really about, and what problem or need does it aim to address?",
    hopes: "What do you hope family members will learn or take away from your entrepreneurial story?",
    support: "How can our family best support your business moving forward?",
    routine: "What is one part of your daily routine?",
    challenge: "What is one challenge you've had to overcome?",
    win: "What is one small win you're proud of?",
    lesson: "What is one lesson business has taught you that you wish you knew earlier?",
    principle: "What principle, habit, or mindset has helped you succeed, and why?",
    advice: "What advice would you give a family member who wants to start or grow their own business?",
    open_to: "Are you open to mentoring a younger family member, or offering an internship?",
  };

  // Which questions go in which card
  const CARD_MAP = {
    origin: ["intro", "inspiration", "purpose", "hopes"],
    speed: ["routine", "challenge", "win"],
    lessons: ["lesson", "principle", "advice", "support", "open_to"],
  };

  // Build a readable dump for the model
  const formatQA = (keys) => keys
    .filter(k => answers[k] && String(answers[k]).trim().length > 0)
    .map(k => `Q: ${Q_LABELS[k]}\nA: ${answers[k]}`)
    .join('\n\n');

  const originQA = formatQA(CARD_MAP.origin);
  const speedQA = formatQA(CARD_MAP.speed);
  const lessonsQA = formatQA(CARD_MAP.lessons);

  const systemPrompt = `You are a thoughtful editor at a family newsletter called the "Aboitiz-Moraza Gazette," preparing an entrepreneur spotlight article. The article is structured as three Q&A cards (Origin Story, Speed Round, Lessons & Advice) — not flattened prose.

Your job:
1. Write a single-sentence TAGLINE (under 25 words) that captures the essence of this business and entrepreneur. Editorial, evocative, not salesy. It will appear in italic under the title.
2. Guess a concise ROLE TITLE for the owner (e.g. "Founder", "Founder & CEO", "Owner & Creative Director"). Default to "Founder" if unclear.
3. Guess a LOCATION in the form "City, Country" from any clues in their answers. If no clues, use "Philippines".
4. For each card, lightly edit each answer: fix grammar, tighten awkward sentences, preserve the owner's voice and specific details. Do NOT invent facts. Do NOT remove content. Keep it first-person. Keep paragraph breaks between ideas.

Return ONLY valid JSON, no markdown fences, no commentary:

{
  "tagline": string,
  "role": string,
  "location": string,
  "cards": {
    "origin": [{"q": string, "a": string}, ...],
    "speed": [{"q": string, "a": string}, ...],
    "lessons": [{"q": string, "a": string}, ...]
  }
}

Rules for the "a" field:
- Use \\n\\n between paragraphs (double newline).
- Preserve all the key facts, names, places, and specific details.
- Do not add preamble like "Certainly!" or editorial asides.
- If an answer is empty or missing, simply omit that Q&A pair from the card array.`;

  const userPrompt = `Entrepreneur: ${owner_name || 'Unknown'}
Business: ${business_name || 'Unknown'}

---
ORIGIN STORY ANSWERS:
${originQA || '(none provided)'}

---
SPEED ROUND ANSWERS:
${speedQA || '(none provided)'}

---
LESSONS & ADVICE ANSWERS:
${lessonsQA || '(none provided)'}

---

Generate the profile JSON now.`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(502).json({ error: 'Anthropic API error: ' + errText });
    }

    const data = await resp.json();
    const text = (data.content || []).map(b => b.text || '').join('').trim();

    // Strip markdown fences if present
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({
        error: 'Model returned non-JSON: ' + cleaned.slice(0, 500),
      });
    }

    // Validate structure
    if (!parsed.cards || typeof parsed.cards !== 'object') {
      return res.status(500).json({ error: 'Missing cards in response' });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// ============================================================
// /api/generate-profile.js — Vercel Serverless Function
// ============================================================
// Takes questionnaire answers, asks Claude to draft polished
// profile copy, returns structured JSON the admin can edit.
//
// Environment variables needed on Vercel:
//   ANTHROPIC_API_KEY - your key from console.anthropic.com
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

  // Build a readable dump of the raw answers
  const answerDump = Object.entries(answers)
    .filter(([k, v]) => v && typeof v === 'string' && v.trim().length > 0)
    .map(([k, v]) => `${k.toUpperCase()}:\n${v}`)
    .join('\n\n');

  const systemPrompt = `You are a thoughtful editor at a family newsletter, crafting intimate profile pieces of family members' businesses for a "Family Entrepreneur Spotlight." Your voice is warm, editorial, and quietly elegant — never corporate, never salesy, never using AI cliches like "unlock potential" or "journey of growth." You write like someone who knows the person personally. You preserve the person's own voice, anecdotes, and specific details; you simply polish and structure.

Return ONLY valid JSON matching this exact shape, no markdown fences, no commentary:

{
  "business_name": string,
  "owner_name": string,
  "tagline": string,  // one evocative sentence, under 20 words
  "sections": [
    { "heading": string, "body": string }  // 3 to 5 sections, each body 80-180 words
  ]
}

Section guidelines:
- Draw sections from their answers. Suggested headings: "The origin", "What we do", "A typical day", "A lesson learned", "What success looks like", "How family can help". Adapt based on what they shared.
- In bodies, use their specific stories and phrases. Keep a reflective, first-person voice (as if the owner wrote it).
- If they didn't share something, don't invent it. Skip that section instead.
- No headings like "About Us" or "Our Mission" — use evocative, specific phrases.`;

  const userPrompt = `Here are the raw questionnaire answers from ${owner_name || 'the entrepreneur'} about their business${business_name ? ` (${business_name})` : ''}:

---
${answerDump}
---

Draft the profile now. Return only the JSON object.`;

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
        max_tokens: 2000,
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

    // Strip code fences if model adds them anyway
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ error: 'Model returned non-JSON: ' + cleaned.slice(0, 300) });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

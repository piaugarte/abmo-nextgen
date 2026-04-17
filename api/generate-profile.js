// ============================================================
// /api/generate-profile.js — Vercel Serverless Function
// ============================================================
// "Clean up answers" pass.
//
// Takes raw questionnaire answers and returns a lightly edited
// version: fixes grammar, punctuation, typos, tightens run-ons
// and awkward phrasing. DOES NOT rewrite, rearrange, or change
// the writer's voice or specific details.
//
// Input:  { answers: { intro: "...", inspiration: "...", ... } }
// Output: { cleaned: { intro: "...", inspiration: "...", ... } }
//
// Env var needed on Vercel: ANTHROPIC_API_KEY
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { answers = {} } = req.body || {};

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY env var' });
  }

  // The long-form text fields worth cleaning up. Short name/contact
  // fields are left alone.
  const CLEANABLE_KEYS = [
    'one_liner',
    'intro', 'inspiration', 'hopes', 'support',
    'routine', 'challenge', 'win',
    'lesson', 'principle', 'advice',
    'open_to',
  ];

  // Build the subset of answers that actually has content
  const toClean = {};
  CLEANABLE_KEYS.forEach(k => {
    if (answers[k] && String(answers[k]).trim().length > 0) {
      toClean[k] = String(answers[k]);
    }
  });

  // If nothing to clean, return empty
  if (Object.keys(toClean).length === 0) {
    return res.status(200).json({ cleaned: {} });
  }

  const systemPrompt = `You are a careful copy editor for a family newsletter. Your job is ONLY to:

1. Fix spelling, grammar, and punctuation errors
2. Tighten genuine run-on sentences and clearly awkward phrasing
3. Preserve the writer's voice, tone, word choices, and personality completely
4. Preserve every fact, name, place, date, and specific detail exactly as written
5. Keep paragraph breaks where the writer put them

DO NOT:
- Rewrite sentences that are already fine
- Change the writer's word choices where they're grammatically correct
- Add flourishes, polish, or "editorial" improvements
- Remove content, condense ideas, or summarize
- Change first-person to third-person or vice versa
- Make the text more formal or more casual than the original

The goal: if someone wrote "me and my brother we started this in 2019 because we thought it was time", you'd return something like "My brother and I started this in 2019 because we thought it was time." You fixed the grammar — but you didn't rewrite it into "In 2019, my brother and I co-founded the company, driven by a shared conviction..."

Return ONLY valid JSON, no markdown fences, no commentary. The JSON must have the exact same keys as the input, with the cleaned text as values. Preserve \\n\\n between paragraphs.

Input will be: { "key1": "original text 1", "key2": "original text 2", ... }
Output must be:  { "key1": "cleaned text 1", "key2": "cleaned text 2", ... }`;

  const userPrompt = `Clean up the following answers. Return ONLY the JSON object.

${JSON.stringify(toClean, null, 2)}`;

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
    const cleanedText = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (e) {
      return res.status(500).json({
        error: 'Model returned non-JSON: ' + cleanedText.slice(0, 500),
      });
    }

    return res.status(200).json({ cleaned: parsed });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

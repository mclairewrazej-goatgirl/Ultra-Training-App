// Reads a training-plan PDF with Claude and returns its workouts as JSON.
// The PDF is only held in memory for this request; nothing is stored.
//
// Vercel environment variables:
//   ANTHROPIC_API_KEY  your Claude API key (platform.claude.com)
//   ALLOWED_EMAILS     comma-separated Google sign-in emails allowed to use this
//   PLAN_MODEL         optional, defaults to claude-opus-5-5
const Anthropic = require('@anthropic-ai/sdk');

const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyDRiIhhg7Uav6cApyUzea_u_WXSZa5fiZs';
const MAX_PDF_BYTES = 3.2 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB; base64 adds a third.
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TYPES = ['Run', 'Long Run', 'Workout', 'Cross Train', 'Strength', 'Rest', 'Race'];

const range = (unitEnum) => ({
  anyOf: [
    {
      type: 'object',
      properties: Object.assign(
        { min: { type: 'number' }, max: { type: 'number' } },
        unitEnum ? { unit: { type: 'string', enum: unitEnum } } : {}
      ),
      required: unitEnum ? ['min', 'max', 'unit'] : ['min', 'max'],
      additionalProperties: false,
    },
    { type: 'null' },
  ],
});

const SCHEMA = {
  type: 'object',
  properties: {
    planName: { type: 'string' },
    totalWeeks: { type: 'integer' },
    raceDay: {
      anyOf: [
        {
          type: 'object',
          properties: { week: { type: 'integer' }, day: { type: 'string', enum: DAYS } },
          required: ['week', 'day'],
          additionalProperties: false,
        },
        { type: 'null' },
      ],
    },
    workouts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          week: { type: 'integer' },
          day: { type: 'string', enum: DAYS },
          type: { type: 'string', enum: TYPES },
          title: { type: 'string' },
          distance: range(['mi', 'km']),
          duration: range(null),
          notes: { type: 'string' },
          sourceText: { type: 'string' },
        },
        required: ['week', 'day', 'type', 'title', 'distance', 'duration', 'notes', 'sourceText'],
        additionalProperties: false,
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['planName', 'totalWeeks', 'raceDay', 'workouts', 'warnings'],
  additionalProperties: false,
};

const INSTRUCTIONS = `This PDF is a running training plan, usually laid out as "Week 1", then Monday to Sunday sessions. Transcribe every scheduled day into "workouts", one entry per session (a day with two sessions gets two entries).

Rules:
- Copy numbers exactly as written and keep the plan's own units. Never convert miles to km or anything else.
- distance: the session's total distance as {min, max, unit}. A single figure has min = max. A range like "8-10 mi" is {min: 8, max: 10}. Use null when the session is given only by time, or when the only distances are interval reps (e.g. "6 x 800m"), not a total.
- duration: total minutes as {min, max} (e.g. "45-60 min" = {min: 45, max: 60}, "1:30" = 90). Null when not given.
- type: Long Run for the week's long run, Workout for intervals, tempo, hills, fartlek or other quality sessions, Run for easy or recovery runs, Cross Train for bike, swim, hike or other aerobic cross-training, Strength for strength or mobility, Rest for rest days, Race for the goal race or a tune-up race.
- title: a short label in the plan's words, max about 60 characters (e.g. "Easy run + 6 strides").
- notes: any further detail for that session (paces, effort, terrain, fuelling). Empty string if none.
- sourceText: the original text for that day, trimmed to at most 200 characters.
- If the plan says "same as week 3" or similar, write out the actual sessions it refers to.
- day is the weekday, Mon to Sun. If the plan numbers days (Day 1-7) instead, Day 1 is Mon.
- raceDay: the week and weekday of the goal race if the plan shows it, else null.
- warnings: anything you could not read or had to guess, in short plain sentences (e.g. "Week 9 Thursday is cut off on page 4"). Empty list if none.`;

async function verifyUser(req) {
  const auth = req.headers.authorization || '';
  const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!idToken) return { error: 'Please sign in first.', status: 401 };
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_WEB_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!r.ok) return { error: 'Your sign-in has expired. Please reload the app.', status: 401 };
  const data = await r.json();
  const user = data.users && data.users[0];
  const email = user && user.email ? user.email.toLowerCase() : '';
  const allowed = (process.env.ALLOWED_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) return { error: 'Plan import isn\'t set up yet: add ALLOWED_EMAILS in Vercel.', status: 500 };
  if (!email || !user.emailVerified || !allowed.includes(email)) return { error: 'This account can\'t import plans.', status: 403 };
  return { email };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Plan import isn\'t set up yet: add ANTHROPIC_API_KEY in Vercel.' });
  }

  try {
    const who = await verifyUser(req);
    if (who.error) return res.status(who.status).json({ error: who.error });
  } catch (err) {
    return res.status(502).json({ error: 'Couldn\'t check your sign-in. Please try again.' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  const pdf = body && typeof body.pdf === 'string' ? body.pdf.replace(/^data:application\/pdf;base64,/, '').replace(/\s/g, '') : '';
  if (!pdf) return res.status(400).json({ error: 'No PDF received.' });
  if (pdf.length * 0.75 > MAX_PDF_BYTES) return res.status(413).json({ error: 'That PDF is too large. Please use one under 3 MB.' });
  if (!pdf.startsWith('JVBER')) return res.status(400).json({ error: 'That file doesn\'t look like a PDF.' });

  const client = new Anthropic();
  try {
    const stream = client.beta.messages.stream({
      model: process.env.PLAN_MODEL || 'claude-opus-5-5',
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf } },
            { type: 'text', text: INSTRUCTIONS },
          ],
        },
      ],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'Claude declined to read this file.' });
    }
    if (message.stop_reason === 'max_tokens') {
      return res.status(422).json({ error: 'This plan is too long to read in one go. Try splitting the PDF.' });
    }
    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const plan = safeParse(text);
    if (!plan || !Array.isArray(plan.workouts)) {
      return res.status(502).json({ error: 'Couldn\'t understand the reply. Please try again.' });
    }
    return res.status(200).json({ plan, usage: message.usage && { input: message.usage.input_tokens, output: message.usage.output_tokens } });
  } catch (err) {
    const status = err && err.status;
    console.error('parse-plan error', status, err && err.message);
    if (status === 401) return res.status(500).json({ error: 'The Claude API key in Vercel isn\'t valid.' });
    if (status === 429) return res.status(429).json({ error: 'Claude is busy or your API credit has run out. Try again shortly.' });
    if (status === 400 && /credit/i.test(err.message || '')) return res.status(402).json({ error: 'Your Claude API credit balance is too low. Add credit at platform.claude.com.' });
    return res.status(502).json({ error: 'Reading the plan failed. Please try again.' });
  }
};

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

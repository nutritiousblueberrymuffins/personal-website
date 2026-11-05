import { readFile } from 'node:fs/promises';
import { app } from '@azure/functions';

// The timeline's source of truth. Edit data/timeline.json to add or change entries.
const DATA_FILE = new URL('../../data/timeline.json', import.meta.url);
const TYPES = ['work', 'education', 'certification', 'project', 'milestone'];

async function loadEntries() {
  const entries = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  // Newest first. Dates are ISO strings (YYYY, YYYY-MM or YYYY-MM-DD), so string order is date order.
  return entries.sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0));
}

// GET /api/timeline            -> every entry
// GET /api/timeline?type=work  -> only entries of that type
app.http('timeline', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const type = request.query.get('type');
    if (type && !TYPES.includes(type)) {
      return {
        status: 400,
        jsonBody: { error: `type must be one of: ${TYPES.join(', ')}` },
      };
    }

    try {
      const entries = await loadEntries();
      const selected = type ? entries.filter((entry) => entry.type === type) : entries;
      return {
        jsonBody: {
          generatedAt: new Date().toISOString(),
          count: selected.length,
          entries: selected,
        },
        headers: { 'Cache-Control': 'public, max-age=3600' },
      };
    } catch (error) {
      context.error('Could not read timeline data', error);
      return { status: 500, jsonBody: { error: 'Timeline data is unavailable' } };
    }
  },
});

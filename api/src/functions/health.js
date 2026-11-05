import { app } from '@azure/functions';

// GET /api/health: confirms the API is running. Used for local smoke tests and, later, uptime checks.
app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async () => ({
    jsonBody: { status: 'ok', time: new Date().toISOString() },
  }),
});

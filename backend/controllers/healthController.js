const mongoose = require('mongoose');

/**
 * GET /api/health
 *
 * Returns the current server and database connection status.
 * Mongoose readyState values:
 *   0 = disconnected | 1 = connected | 2 = connecting | 3 = disconnecting
 */
const getHealth = (req, res) => {
  const dbState = mongoose.connection.readyState;

  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const dbStatus = stateMap[dbState] ?? 'unknown';
  const isHealthy = dbState === 1;

  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    server: 'running',
    database: {
      status: dbStatus,
      host: mongoose.connection.host ?? null,
      name: mongoose.connection.name ?? null,
    },
  });
};

module.exports = { getHealth };

// redisClient.js
// Cache layer used by the controllers. Uses Redis when REDIS_URL is set and reachable,
// otherwise falls back to a simple in-memory cache so the app still runs locally.
import { createClient } from 'redis';

// ---------- In-memory fallback ----------
const memory = new Map(); // key -> { value, expiresAt }

const globToRegex = (pattern) =>
  new RegExp('^' + pattern.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');

const memoryCache = {
  async get(key) {
    const entry = memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      memory.delete(key);
      return null;
    }
    return entry.value;
  },
  async setEx(key, seconds, value) {
    memory.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
  },
  async del(keys) {
    [].concat(keys).forEach(k => memory.delete(k));
  },
  async keys(pattern) {
    const regex = globToRegex(pattern);
    return [...memory.keys()].filter(k => regex.test(k));
  },
};

// ---------- Redis (optional) ----------
let redis = null;

if (process.env.REDIS_URL) {
  const redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
      // Give up after a few attempts instead of retrying forever
      reconnectStrategy: (retries) => (retries > 3 ? new Error('Redis unavailable') : 500),
    },
  });
  redisClient.on('error', (err) => console.error('Redis Client Error:', err.message));

  try {
    await redisClient.connect();
    redis = redisClient;
    console.log('Redis connected');
  } catch (err) {
    console.warn(`Redis connection failed (${err.message}). Using in-memory cache.`);
  }
} else {
  console.log('REDIS_URL not set. Using in-memory cache.');
}

// Run against Redis if it is healthy, otherwise use memory
const run = async (op, ...args) => {
  if (redis?.isReady) {
    try {
      return await redis[op](...args);
    } catch (err) {
      console.error(`Redis ${op} failed, using memory cache:`, err.message);
    }
  }
  return memoryCache[op](...args);
};

const client = {
  get: (key) => run('get', key),
  setEx: (key, seconds, value) => run('setEx', key, seconds, value),
  del: (keys) => run('del', keys),
  // Delete every key matching a glob pattern, e.g. "leaderboard:123:*"
  async delPattern(pattern) {
    const keys = await run('keys', pattern);
    if (keys.length > 0) await run('del', keys);
  },
};

export default client;

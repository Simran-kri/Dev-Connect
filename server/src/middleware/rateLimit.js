// Minimal in-memory rate limiter. Good enough for a single-instance deploy
// (Render free tier, one dyno). If you ever scale to multiple instances,
// swap this for a Redis-backed limiter (e.g. `rate-limiter-flexible`) since
// in-memory counters aren't shared across processes.
export function rateLimit({ windowMs, max, message }) {
  const hits = new Map();

  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, timestamps] of hits) {
      const recent = timestamps.filter((time) => time > cutoff);
      if (recent.length) hits.set(key, recent);
      else hits.delete(key);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (hits.get(key) || []).filter((time) => time > cutoff);

    if (timestamps.length >= max) {
      return res.status(429).json({ message: message || "Too many requests, please try again later." });
    }

    timestamps.push(now);
    hits.set(key, timestamps);
    next();
  };
}

/**
 * JWT Configuration & Secret Validator
 * 
 * Strict Security Rules:
 * 1. No hardcoded fallback secrets in code or token generation/verification.
 * 2. In production, fail startup if JWT_SECRET is absent or insecurely configured (< 32 chars or trivial).
 * 3. In development/testing, requires explicit environment configuration via .env or process.env.
 * 4. Never print or log the secret value.
 */

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (!secret || typeof secret !== 'string' || secret.trim() === '') {
    if (isProd) {
      throw new Error('FATAL: JWT_SECRET environment variable is missing in production. Startup aborted for security compliance.');
    }
    throw new Error('JWT_SECRET is not configured. Please define JWT_SECRET in your .env or environment variables.');
  }

  if (isProd) {
    if (secret.length < 32) {
      throw new Error('FATAL: JWT_SECRET in production is insecurely configured (must be at least 32 characters). Startup aborted.');
    }
    const trivialPatterns = ['secret', 'default', 'fallback', '123456', 'changeme', 'password'];
    const lower = secret.toLowerCase();
    if (trivialPatterns.some(p => lower.includes(p))) {
      throw new Error('FATAL: JWT_SECRET in production contains trivial or default patterns. Startup aborted.');
    }
  }

  return secret;
}

function validateJwtConfig() {
  // Executes check and throws if invalid
  return getJwtSecret();
}

module.exports = {
  getJwtSecret,
  validateJwtConfig
};

import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env here — env.ts is always the first module to read process.env,
// and ES module static imports are hoisted before dotenv.config() in index.ts runs.
dotenv.config();

// Placeholders that developers forget to replace
const PLACEHOLDER_PATTERNS = [
  /^REPLACE_WITH/i,
  /^your_.*_here$/i,
  /^change_in_production$/i,
  /^secret$/i,
];

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function requireSecret(fieldName: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`[ENV] Missing required environment variable: ${fieldName}`);
  }
  if (isPlaceholder(value)) {
    throw new Error(
      `[ENV] ${fieldName} is still set to a placeholder value. ` +
      `Generate a real secret with: openssl rand -base64 64`,
    );
  }
  if (fieldName === 'JWT_SECRET' && value.length < 32) {
    throw new Error(
      `[ENV] JWT_SECRET must be at least 32 characters long. ` +
      `Generate one with: openssl rand -base64 64`,
    );
  }
  return value;
}

const envSchema = z.object({
  PORT: z.string().default('8080'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  GEMINI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  NASA_API_KEY: z.string().optional(),
  CLIENT_URL: z.string().url('CLIENT_URL must be a valid URL').default('http://localhost:5173'),
});

function loadEnv() {
  // Validate JWT_SECRET strictly — it is the most critical secret
  requireSecret('JWT_SECRET', process.env.JWT_SECRET);

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.errors.map((e) => `  • ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`[ENV] Environment validation failed:\n${issues}`);
  }

  return result.data;
}

// Throws at startup if the environment is misconfigured
export const env = loadEnv();

export type Env = typeof env;

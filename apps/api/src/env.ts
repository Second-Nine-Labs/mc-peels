import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  /** Legacy HS256 secret. If unset, JWTs are verified against SUPABASE_URL's JWKS. */
  SUPABASE_JWT_SECRET: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default('claude-haiku-4-5-20251001'),
  INSTACART_API_KEY: z.string().min(1),
  INSTACART_ENV: z.enum(['development', 'production']).default('development'),
  APP_BASE_URL: z.string().url().optional(),
  PORT: z.coerce.number().default(3000),
  // Fulfillment rails. CSV in display order; default keeps existing deploys
  // Instacart-only until the flag is flipped (no code deploy needed).
  FULFILLMENT_PROVIDERS: z.string().default('instacart'),
  KROGER_CLIENT_ID: z.string().optional(),
  KROGER_CLIENT_SECRET: z.string().optional(),
  KROGER_BASE_URL: z.string().url().default('https://api.kroger.com'),
  /** base64, 32 bytes (openssl rand -base64 32). Validated at first use. */
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  /** Public origin of THIS API — the base for OAuth redirect_uris. */
  API_PUBLIC_URL: z.string().url().optional(),
  /** Origins allowed as post-OAuth return destinations (besides mcpeels:// and localhost). */
  CONNECT_RETURN_ORIGINS: z.string().default('https://mc-peels.secondninelabs.com'),
  QUOTE_CACHE_TTL_MINUTES: z.coerce.number().default(360),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Lazily validated so unit tests can run without a full environment. */
export function env(): Env {
  if (!cached) {
    cached = envSchema.parse(process.env);
  }
  return cached;
}

export const INSTACART_BASE_URLS = {
  development: 'https://connect.dev.instacart.tools',
  production: 'https://connect.instacart.com',
} as const;

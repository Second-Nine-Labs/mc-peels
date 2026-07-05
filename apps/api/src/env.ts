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

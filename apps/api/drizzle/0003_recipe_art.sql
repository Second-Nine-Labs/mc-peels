-- Lane 2: generated dish art, cached per shelf save.
ALTER TABLE "recipes"
  ADD COLUMN IF NOT EXISTS "art_url" text,
  ADD COLUMN IF NOT EXISTS "art_status" text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "art_updated_at" timestamp with time zone;--> statement-breakpoint
-- Public bucket for the cached tiles (idempotent; read-only to the world,
-- writes go through the API's service-role key).
INSERT INTO storage.buckets (id, name, public)
VALUES ('eats-art', 'eats-art', true)
ON CONFLICT (id) DO NOTHING;

-- Stage 3: generated kitchen identities, cached per (household, cuisine).
-- The Shelf mints kitchens from saves; for cuisines without a hand-built
-- flagship costume, an LLM writes the identity once (name, sub, tagline,
-- voice, palette seed) and a hero image generates async on top. Locked at
-- first open so the name doesn't drift as more of that cuisine is saved.
CREATE TABLE IF NOT EXISTS "kitchen_identities" (
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "cuisine" text NOT NULL,
  "name" text NOT NULL,
  "sub" text NOT NULL,
  "tagline" text NOT NULL,
  "mono" boolean NOT NULL DEFAULT false,
  "palette" jsonb NOT NULL,
  "voice" jsonb,
  "hero_url" text,
  "hero_status" text NOT NULL DEFAULT 'none',
  "hero_updated_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "kitchen_identities_pkey" PRIMARY KEY ("household_id", "cuisine")
);--> statement-breakpoint
-- Match the house pattern: RLS on, no policies — the API talks to Postgres
-- directly (bypasses RLS); the anon/authenticated PostgREST roles see nothing.
ALTER TABLE "kitchen_identities" ENABLE ROW LEVEL SECURITY;

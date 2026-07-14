CREATE TYPE "public"."offer_status" AS ENUM('pending', 'quoted', 'unpriced', 'failed');--> statement-breakpoint
CREATE TABLE "cart_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"status" "offer_status" DEFAULT 'pending' NOT NULL,
	"handoff_url" text,
	"store" jsonb DEFAULT 'null'::jsonb,
	"subtotal_cents" integer,
	"promo_savings_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"matched_count" integer DEFAULT 0 NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"item_matches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quoted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"scopes" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"postal_code" text NOT NULL,
	"store" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_match_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"store_id" text NOT NULL,
	"normalized_term" text NOT NULL,
	"response" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_offers" ADD CONSTRAINT "cart_offers_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cart_offers_cart_provider_idx" ON "cart_offers" USING btree ("cart_id","provider");--> statement-breakpoint
CREATE INDEX "cart_offers_cart_idx" ON "cart_offers" USING btree ("cart_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_connections_user_provider_idx" ON "provider_connections" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_locations_key_idx" ON "provider_locations" USING btree ("provider","postal_code");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_match_cache_key_idx" ON "provider_match_cache" USING btree ("provider","store_id","normalized_term");
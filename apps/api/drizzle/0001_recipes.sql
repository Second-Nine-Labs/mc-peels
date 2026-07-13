CREATE TYPE "public"."recipe_provenance" AS ENUM('transcribed', 'reconstructed');--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"added_by_user_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"source_platform" text NOT NULL,
	"creator" text,
	"title" text NOT NULL,
	"sub" text,
	"description" text,
	"cuisine" text NOT NULL,
	"dish_type" text NOT NULL,
	"serves" integer NOT NULL,
	"minutes" integer NOT NULL,
	"heat" integer,
	"ingredients" jsonb NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provenance" "recipe_provenance" NOT NULL,
	"confidence" text DEFAULT 'medium' NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_household_source_idx" ON "recipes" USING btree ("household_id","source_url");--> statement-breakpoint
CREATE INDEX "recipes_household_created_idx" ON "recipes" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE INDEX "recipes_household_cuisine_idx" ON "recipes" USING btree ("household_id","cuisine");
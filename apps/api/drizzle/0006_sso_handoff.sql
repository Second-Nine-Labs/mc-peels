-- One-time nonces for cross-app session handoff (Third Brain → signed-in
-- MC Peels web session). docs/fix-third-brain-connect.md, NEW ASK section.

CREATE TABLE "sso_handoff_nonces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nonce_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"redirect_to" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sso_handoff_nonces_nonce_hash_unique" UNIQUE("nonce_hash")
);

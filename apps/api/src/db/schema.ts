import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Enums --------------------------------------------------------------------

export const memberRole = pgEnum('member_role', ['owner', 'member']);
export const requestChannel = pgEnum('request_channel', ['app', 'mcp']);
// v1 only ever produces 'direct_request'; 'recipe' is the phase-2 hook (PRD section 7).
export const lineItemSource = pgEnum('line_item_source', ['direct_request', 'recipe']);
// Best-effort only: the Instacart API returns a link, not order state (PRD section 7 notes).
export const cartStatus = pgEnum('cart_status', ['created', 'opened', 'expired']);
// Offer lifecycle: 'pending' (seeded, quote not run), 'quoted' (real prices),
// 'unpriced' (service exposes no prices — handoff only), 'failed' (quote errored).
export const offerStatus = pgEnum('offer_status', ['pending', 'quoted', 'unpriced', 'failed']);

// Tables -------------------------------------------------------------------

export const households = pgTable('households', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  preferredRetailerKey: text('preferred_retailer_key'),
  postalCode: text('postal_code').notNull(),
  countryCode: text('country_code').notNull().default('US'),
  // Supabase auth.users id; no FK because auth lives in a separate schema.
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const householdMembers = pgTable(
  'household_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    role: memberRole('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('household_members_household_user_idx').on(t.householdId, t.userId),
    index('household_members_user_idx').on(t.userId),
  ],
);

export const dietaryProfiles = pgTable('dietary_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .unique()
    .references(() => households.id, { onDelete: 'cascade' }),
  preferOrganic: boolean('prefer_organic').notNull().default(false),
  preferredBrands: jsonb('preferred_brands').$type<string[]>().notNull().default([]),
  excludedIngredients: jsonb('excluded_ingredients').$type<string[]>().notNull().default([]),
  allergens: jsonb('allergens').$type<string[]>().notNull().default([]),
  // Additional Instacart health filters applied globally (PRD section 8).
  healthFilters: jsonb('health_filters').$type<string[]>().notNull().default([]),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const requests = pgTable(
  'requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    requestedByUserId: uuid('requested_by_user_id').notNull(),
    rawText: text('raw_text').notNull(),
    channel: requestChannel('channel').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('requests_household_idx').on(t.householdId, t.createdAt)],
);

export const carts = pgTable(
  'carts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    requestId: uuid('request_id')
      .notNull()
      .references(() => requests.id, { onDelete: 'cascade' }),
    retailerKey: text('retailer_key'),
    title: text('title').notNull(),
    instacartUrl: text('instacart_url').notNull(),
    status: cartStatus('status').notNull().default('created'),
    createdByUserId: uuid('created_by_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('carts_household_idx').on(t.householdId, t.createdAt)],
);

export type AppliedFilters = {
  health_filters: string[];
  brand_filters: string[];
};

export const lineItems = pgTable(
  'line_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => requests.id, { onDelete: 'cascade' }),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    cartId: uuid('cart_id').references(() => carts.id, { onDelete: 'set null' }),
    // Forward-compatibility hook for phase-2 grouping (PRD section 7).
    source: lineItemSource('source').notNull().default('direct_request'),
    name: text('name').notNull(),
    quantity: numeric('quantity', { precision: 10, scale: 3 }),
    unit: text('unit'),
    appliedFilters: jsonb('applied_filters')
      .$type<AppliedFilters>()
      .notNull()
      .default({ health_filters: [], brand_filters: [] }),
    resolvedDisplayText: text('resolved_display_text').notNull(),
    // e.g. allergen conflicts surfaced to the human reviewer (PRD section 8).
    warnings: jsonb('warnings').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('line_items_request_idx').on(t.requestId),
    index('line_items_cart_idx').on(t.cartId),
  ],
);

export const householdInvites = pgTable(
  'household_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    code: text('code').notNull().unique(),
    createdBy: uuid('created_by').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('household_invites_household_idx').on(t.householdId)],
);

// Recipes ingested from links — the shelf (PRD section 12, "recipe concoction").
// 'transcribed' = the source actually contained the ingredient list;
// 'reconstructed' = the dish was rebuilt from a name/partial hints and says so.
export const recipeProvenance = pgEnum('recipe_provenance', ['transcribed', 'reconstructed']);

/** One stored ingredient — mirrors the client's CanonIngredient shape, so a
 * saved recipe drops straight into the thrift solver and POST /carts. */
export type RecipeIngredient = {
  /** Clean product name suitable for Instacart store search. */
  name: string;
  quantity?: number;
  unit?: string;
  /** Assumed on-hand (salt, oil, spices) — excluded from carts by default. */
  pantry?: boolean;
};

export const recipes = pgTable(
  'recipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    addedByUserId: uuid('added_by_user_id').notNull(),
    /** Normalized (tracking params stripped, redirects resolved) — the dedupe key. */
    sourceUrl: text('source_url').notNull(),
    // Text, not an enum: a new platform should never need a migration.
    sourcePlatform: text('source_platform').notNull(),
    /** Credit to the human whose recipe this is, when the source names them. */
    creator: text('creator'),
    title: text('title').notNull(),
    /** Native-script or stylized secondary name (辣子鸡 / tres leches). */
    sub: text('sub'),
    description: text('description'),
    cuisine: text('cuisine').notNull(),
    dishType: text('dish_type').notNull(),
    serves: integer('serves').notNull(),
    minutes: integer('minutes').notNull(),
    /** Chile scale 0-3; null when heat is not the point. */
    heat: integer('heat'),
    ingredients: jsonb('ingredients').$type<RecipeIngredient[]>().notNull(),
    steps: jsonb('steps').$type<string[]>().notNull().default([]),
    provenance: recipeProvenance('provenance').notNull(),
    confidence: text('confidence').notNull().default('medium'),
    /** Extraction + resolver notes, surfaced to the human. Never silently dropped. */
    notes: jsonb('notes').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('recipes_household_source_idx').on(t.householdId, t.sourceUrl),
    index('recipes_household_created_idx').on(t.householdId, t.createdAt),
    index('recipes_household_cuisine_idx').on(t.householdId, t.cuisine),
  ],
);

// Personal access tokens used by MCP clients (Chief of Staff) to act as a user.
// Only a SHA-256 hash is stored; the plaintext is shown once at creation.
export const apiTokens = pgTable(
  'api_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('api_tokens_user_idx').on(t.userId)],
);

// Fulfillment — parallel rails + price comparison ---------------------------

/** Provider-scoped store identity, denormalized for display. */
export type OfferStoreRef = {
  provider_store_id: string;
  name: string;
  address?: string;
  chain?: string;
  logo_url?: string | null;
};

/**
 * One line item's resolution against a provider's catalog. Snake_case because
 * this jsonb is served to clients verbatim (mirrors AppliedFilters precedent).
 */
export type OfferItemMatch = {
  line_item_id: string | null;
  requested_name: string;
  requested_quantity: number | null;
  requested_unit: string | null;
  status: 'matched' | 'no_match' | 'unpriced';
  confidence: 'high' | 'medium' | 'low' | null;
  product: {
    product_id: string;
    upc?: string;
    description: string;
    brand?: string;
    size?: string;
    sold_by?: string;
  } | null;
  /** Discrete quantity we would push to the provider's cart. */
  quantity: number;
  unit_price_cents: number | null;
  regular_price_cents: number | null;
  promo_price_cents: number | null;
  line_total_cents: number | null;
  promo_savings_cents: number;
  warnings: string[];
};

/**
 * One provider's offer for a cart: a real quote (Kroger), an unpriced handoff
 * (Instacart, DoorDash, Uber Eats), or a failed quote. Real prices only —
 * subtotal_cents is null unless the provider's API priced the items.
 */
export const cartOffers = pgTable(
  'cart_offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    // Text, not an enum: a new provider should never need a migration.
    provider: text('provider').notNull(),
    status: offerStatus('status').notNull().default('pending'),
    handoffUrl: text('handoff_url'),
    store: jsonb('store').$type<OfferStoreRef | null>().default(null),
    /** Items subtotal — never a "total"; taxes/fees belong to the service. */
    subtotalCents: integer('subtotal_cents'),
    promoSavingsCents: integer('promo_savings_cents').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    matchedCount: integer('matched_count').notNull().default(0),
    totalCount: integer('total_count').notNull().default(0),
    itemMatches: jsonb('item_matches').$type<OfferItemMatch[]>().notNull().default([]),
    notes: jsonb('notes').$type<string[]>().notNull().default([]),
    quotedAt: timestamp('quoted_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('cart_offers_cart_provider_idx').on(t.cartId, t.provider),
    index('cart_offers_cart_idx').on(t.cartId),
  ],
);

/**
 * A user's linked account at a provider (e.g. Kroger OAuth grant). Tokens are
 * AES-256-GCM encrypted at rest (`v1.<iv>.<ct>.<tag>`, AAD-bound to
 * `${userId}:${provider}`) — plaintext never touches the database or clients.
 */
export const providerConnections = pgTable(
  'provider_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Supabase auth.users id; no FK because auth lives in a separate schema.
    userId: uuid('user_id').notNull(),
    provider: text('provider').notNull(),
    accessTokenEnc: text('access_token_enc').notNull(),
    refreshTokenEnc: text('refresh_token_enc').notNull(),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }).notNull(),
    scopes: text('scopes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('provider_connections_user_provider_idx').on(t.userId, t.provider)],
);

/**
 * Catalog-search cache: top candidates (with prices) for a normalized term at
 * one provider store. Lazy TTL (QUOTE_CACHE_TTL_MINUTES) — refreshed in place
 * on stale read; most of the 10k/day rate-limit budget lives here.
 */
export const providerMatchCache = pgTable(
  'provider_match_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    storeId: text('store_id').notNull(),
    normalizedTerm: text('normalized_term').notNull(),
    response: jsonb('response').notNull(),
    cachedAt: timestamp('cached_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('provider_match_cache_key_idx').on(t.provider, t.storeId, t.normalizedTerm),
  ],
);

/** Nearest provider store per postal code. Lazy 30-day TTL. */
export const providerLocations = pgTable(
  'provider_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    postalCode: text('postal_code').notNull(),
    store: jsonb('store').$type<OfferStoreRef>().notNull(),
    cachedAt: timestamp('cached_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('provider_locations_key_idx').on(t.provider, t.postalCode)],
);

export type Household = typeof households.$inferSelect;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type DietaryProfile = typeof dietaryProfiles.$inferSelect;
export type Request = typeof requests.$inferSelect;
export type Cart = typeof carts.$inferSelect;
export type LineItem = typeof lineItems.$inferSelect;
export type HouseholdInvite = typeof householdInvites.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type CartOffer = typeof cartOffers.$inferSelect;
export type ProviderConnection = typeof providerConnections.$inferSelect;
export type ProviderLocation = typeof providerLocations.$inferSelect;

import {
  boolean,
  index,
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

export type Household = typeof households.$inferSelect;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type DietaryProfile = typeof dietaryProfiles.$inferSelect;
export type Request = typeof requests.$inferSelect;
export type Cart = typeof carts.$inferSelect;
export type LineItem = typeof lineItems.$inferSelect;
export type HouseholdInvite = typeof householdInvites.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;

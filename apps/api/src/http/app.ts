import { waitUntil } from '@vercel/functions';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import { verifySupabaseToken } from '../auth/supabase.js';
import { createApiToken, listApiTokens, revokeApiToken } from '../auth/tokens.js';
import {
  createCart,
  getCartWithItems,
  listRecentCarts,
  listUsualItems,
  markCartOpened,
} from '../core/carts.js';
import { deleteConnection, listConnections, saveConnection } from '../core/connections.js';
import { krogerHandoff } from '../core/handoff.js';
import { refreshOffers } from '../core/offers.js';
import { AppError, notFound, unauthorized, validationError } from '../core/errors.js';
import { getKrogerClient } from '../fulfillment/kroger/client.js';
import {
  buildAuthorizeUrl,
  krogerRedirectUri,
  signState,
  validateReturnTo,
  verifyState,
  withResult,
} from '../fulfillment/kroger/oauth.js';
import { getProvider } from '../fulfillment/registry.js';
import {
  createHousehold,
  createInvite,
  getHouseholdDetail,
  getProfile,
  joinHousehold,
  listMemberships,
  putProfile,
  updateHousehold,
} from '../core/households.js';
import { artConfigured, ensureRecipeArt, ensureRecipeArtForUser } from '../art/pipeline.js';
import { deleteRecipe, ingestRecipe, listRecipes } from '../core/recipes.js';
import { listRetailers } from '../core/retailers.js';
import { HEALTH_FILTERS } from '../types.js';
import { mcpRoute } from '../mcp/route.js';
import {
  cartDetailJson,
  cartSummaryJson,
  householdJson,
  lineItemJson,
  offerJson,
  profileJson,
  recipeJson,
  retailerJson,
} from './serializers.js';

type Vars = { Variables: { userId: string; email: string | null } };

/** Parse a JSON body against a zod schema, mapping failures to 400s. */
async function body<T extends z.ZodTypeAny>(c: { req: { json(): Promise<unknown> } }, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw validationError('Request body must be valid JSON');
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    throw validationError(`${path ? `${path}: ` : ''}${issue?.message ?? 'Invalid request body'}`);
  }
  return result.data;
}

const healthFilterEnum = z.enum(HEALTH_FILTERS);

const uuidSchema = z.string().uuid();

/** Malformed path ids 404 like any other unknown id (avoids Postgres 22P02 -> 500). */
function uuidParam(value: string, what: string): string {
  if (!uuidSchema.safeParse(value).success) {
    throw notFound(`${what} not found`);
  }
  return value;
}

/** Optional household_id query params must be UUIDs when present. */
function uuidQuery(value: string | undefined, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (!uuidSchema.safeParse(value).success) {
    throw validationError(`${name} must be a UUID`);
  }
  return value;
}

const createHouseholdSchema = z.object({
  name: z.string().min(1).max(120),
  postal_code: z.string().min(3).max(10),
  country_code: z.enum(['US', 'CA']),
});

const patchHouseholdSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  postal_code: z.string().min(3).max(10).optional(),
  country_code: z.enum(['US', 'CA']).optional(),
  preferred_retailer_key: z.string().min(1).max(100).nullable().optional(),
});

const profileSchema = z.object({
  prefer_organic: z.boolean(),
  preferred_brands: z.array(z.string().min(1)).max(50),
  excluded_ingredients: z.array(z.string().min(1)).max(100),
  allergens: z.array(z.string().min(1)).max(100),
  health_filters: z.array(healthFilterEnum).max(HEALTH_FILTERS.length),
  notes: z.string().max(2000).nullable().optional(),
});

const ingestRecipeSchema = z.object({
  household_id: z.string().uuid().optional(),
  url: z.string().min(8).max(2048),
});

const createCartSchema = z.object({
  household_id: z.string().uuid().optional(),
  request_text: z.string().max(4000).optional(),
  line_items: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        quantity: z.number().positive().optional(),
        unit: z.string().min(1).max(40).optional(),
      }),
    )
    .min(1)
    .max(100)
    .optional(),
  retailer_key: z.string().min(1).max(100).optional(),
});

const refreshOffersSchema = z.object({
  providers: z.array(z.string().min(1).max(40)).max(10).optional(),
  force: z.boolean().optional(),
});

/** Like body(), but tolerates an empty body (POSTs with no options). */
async function optionalBody<T extends z.ZodTypeAny>(
  c: { req: { text(): Promise<string> } },
  schema: T,
): Promise<z.infer<T>> {
  const raw = await c.req.text();
  if (raw.trim() === '') return schema.parse({});
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw validationError('Request body must be valid JSON');
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    throw validationError(`${path ? `${path}: ` : ''}${issue?.message ?? 'Invalid request body'}`);
  }
  return result.data;
}

export function createApp() {
  const app = new Hono<Vars>();

  // The Expo web target calls the API cross-origin with an Authorization
  // header, which forces a CORS preflight. Auth is bearer-token (never
  // cookies), so a permissive origin is safe here.
  app.use(
    '*',
    cors({
      origin: '*',
      allowHeaders: ['Authorization', 'Content-Type', 'mcp-session-id', 'mcp-protocol-version'],
      exposeHeaders: ['mcp-session-id'],
    }),
  );

  // Friendly root so visiting the bare domain in a browser shows the service
  // is alive instead of a 404 (this host serves the API, not the consumer app).
  app.get('/', (c) =>
    c.json({
      service: 'MC Peels API',
      status: 'ok',
      endpoints: {
        health: '/health',
        rest: '/api/v1 (Supabase bearer auth)',
        mcp: '/mcp (mcp_ personal access token)',
      },
      docs: 'https://github.com/Second-Nine-Labs/mc-peels',
    }),
  );

  app.get('/health', (c) => c.json({ ok: true }));

  // MCP front door — authenticates with its own mcp_ bearer tokens.
  app.route('/mcp', mcpRoute);

  // Provider account linking. Mounted OUTSIDE the bearer-authed sub-app:
  // the OAuth callback arrives as a bare browser redirect. /start still
  // authenticates — explicitly, inside the handler.
  const connect = new Hono<Vars>();

  connect.get('/kroger/start', async (c) => {
    const header = c.req.header('Authorization');
    if (!header?.startsWith('Bearer ')) throw unauthorized('Missing bearer token');
    const user = await verifySupabaseToken(header.slice('Bearer '.length));

    if (!getProvider('kroger')) {
      throw validationError('Kroger is not enabled on this server.');
    }
    const returnToRaw = c.req.query('return_to');
    if (!returnToRaw) throw validationError('return_to is required');
    let returnTo: string;
    try {
      returnTo = validateReturnTo(returnToRaw);
    } catch (err) {
      throw validationError((err as Error).message);
    }
    const state = await signState({ uid: user.userId, returnTo });
    return c.json({ authorize_url: buildAuthorizeUrl(state) });
  });

  connect.get('/kroger/callback', async (c) => {
    const stateRaw = c.req.query('state');
    if (!stateRaw) {
      throw validationError('Missing state parameter');
    }
    // Identity + destination come from the signed state — tamper/expiry throws.
    let state;
    try {
      state = await verifyState(stateRaw);
    } catch {
      throw validationError('Invalid or expired connect link — start over from the cart.');
    }

    const denied = c.req.query('error');
    if (denied) {
      return c.redirect(withResult(state.returnTo, 'error', denied), 302);
    }
    const code = c.req.query('code');
    if (!code) {
      return c.redirect(withResult(state.returnTo, 'error', 'missing_code'), 302);
    }
    try {
      // redirect_uri must byte-match the one sent on /authorize.
      const grant = await getKrogerClient().exchangeAuthCode(code, krogerRedirectUri());
      await saveConnection(state.uid, 'kroger', grant);
      return c.redirect(withResult(state.returnTo, 'connected'), 302);
    } catch (err) {
      console.error('Kroger code exchange failed:', err);
      return c.redirect(withResult(state.returnTo, 'error', 'exchange_failed'), 302);
    }
  });

  app.route('/api/v1/connect', connect);

  const api = new Hono<Vars>();

  api.use('*', async (c, next) => {
    const header = c.req.header('Authorization');
    if (!header?.startsWith('Bearer ')) {
      throw unauthorized('Missing bearer token');
    }
    const user = await verifySupabaseToken(header.slice('Bearer '.length));
    c.set('userId', user.userId);
    c.set('email', user.email);
    await next();
  });

  // Identity -----------------------------------------------------------------

  api.get('/me', async (c) => {
    const memberships = await listMemberships(c.get('userId'));
    return c.json({
      user: { id: c.get('userId'), email: c.get('email') },
      memberships: memberships.map((m) => ({
        household_id: m.membership.householdId,
        role: m.membership.role,
        household: householdJson(m.household),
      })),
    });
  });

  // Households -----------------------------------------------------------------

  api.post('/households', async (c) => {
    const input = await body(c, createHouseholdSchema);
    const household = await createHousehold(c.get('userId'), {
      name: input.name,
      postalCode: input.postal_code,
      countryCode: input.country_code,
    });
    return c.json(householdJson(household), 201);
  });

  api.get('/households/:id', async (c) => {
    const detail = await getHouseholdDetail(
      c.get('userId'),
      uuidParam(c.req.param('id'), 'Household'),
    );
    return c.json({
      household: householdJson(detail.household),
      members: detail.members.map((m) => ({
        user_id: m.userId,
        role: m.role,
        joined_at: m.joinedAt.toISOString(),
      })),
      dietary_profile: profileJson(detail.profile),
    });
  });

  api.patch('/households/:id', async (c) => {
    const input = await body(c, patchHouseholdSchema);
    const household = await updateHousehold(c.get('userId'), uuidParam(c.req.param('id'), 'Household'), {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.postal_code !== undefined ? { postalCode: input.postal_code } : {}),
      ...(input.country_code !== undefined ? { countryCode: input.country_code } : {}),
      ...(input.preferred_retailer_key !== undefined
        ? { preferredRetailerKey: input.preferred_retailer_key }
        : {}),
    });
    return c.json(householdJson(household));
  });

  api.post('/households/:id/invites', async (c) => {
    const invite = await createInvite(c.get('userId'), uuidParam(c.req.param('id'), 'Household'));
    return c.json({ code: invite.code, expires_at: invite.expiresAt.toISOString() }, 201);
  });

  api.post('/households/join', async (c) => {
    const input = await body(c, z.object({ code: z.string().min(4).max(16) }));
    const household = await joinHousehold(c.get('userId'), input.code);
    return c.json(householdJson(household));
  });

  // Dietary profile -------------------------------------------------------------

  api.get('/households/:id/dietary-profile', async (c) => {
    const profile = await getProfile(c.get('userId'), uuidParam(c.req.param('id'), 'Household'));
    return c.json(profileJson(profile));
  });

  api.put('/households/:id/dietary-profile', async (c) => {
    const input = await body(c, profileSchema);
    const saved = await putProfile(c.get('userId'), uuidParam(c.req.param('id'), 'Household'), {
      preferOrganic: input.prefer_organic,
      preferredBrands: input.preferred_brands,
      excludedIngredients: input.excluded_ingredients,
      allergens: input.allergens,
      healthFilters: input.health_filters,
      notes: input.notes ?? null,
    });
    return c.json(profileJson(saved));
  });

  // Retailers -------------------------------------------------------------------

  api.get('/retailers', async (c) => {
    const retailers = await listRetailers(c.get('userId'), {
      householdId: uuidQuery(c.req.query('household_id'), 'household_id'),
      postalCode: c.req.query('postal_code'),
      countryCode: c.req.query('country_code'),
    });
    return c.json({ retailers: retailers.map(retailerJson) });
  });

  // Carts (the core flow) ---------------------------------------------------------

  api.post('/carts', async (c) => {
    const input = await body(c, createCartSchema);
    const result = await createCart({
      userId: c.get('userId'),
      householdId: input.household_id,
      channel: 'app',
      requestText: input.request_text,
      lineItems: input.line_items,
      retailerKey: input.retailer_key,
    });
    return c.json(
      {
        cart_id: result.cartId,
        request_id: result.requestId,
        instacart_url: result.instacartUrl,
        retailer: result.retailer ? retailerJson(result.retailer) : null,
        resolved_line_items: result.resolvedLineItems.map(lineItemJson),
        offers: result.offers.map(offerJson),
        notes: result.notes,
      },
      201,
    );
  });

  api.get('/carts', async (c) => {
    const limitRaw = c.req.query('limit');
    const limit = limitRaw === undefined ? undefined : Number(limitRaw);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
      throw validationError('limit must be a positive integer');
    }
    const carts = await listRecentCarts(c.get('userId'), {
      householdId: uuidQuery(c.req.query('household_id'), 'household_id'),
      limit,
    });
    return c.json({ carts: carts.map(cartSummaryJson) });
  });

  api.get('/carts/:id', async (c) => {
    const cart = await getCartWithItems(c.get('userId'), uuidParam(c.req.param('id'), 'Cart'));
    if (!cart) throw notFound('Cart not found');
    return c.json(cartDetailJson(cart));
  });

  // The household's recurring items — one-tap re-add on the Ask screen.
  api.get('/usuals', async (c) => {
    const limitRaw = c.req.query('limit');
    const limit = limitRaw === undefined ? undefined : Number(limitRaw);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
      throw validationError('limit must be a positive integer');
    }
    const usuals = await listUsualItems(c.get('userId'), {
      householdId: uuidQuery(c.req.query('household_id'), 'household_id'),
      limit,
    });
    return c.json({ usuals });
  });

  api.post('/carts/:id/opened', async (c) => {
    const cart = await markCartOpened(c.get('userId'), uuidParam(c.req.param('id'), 'Cart'));
    if (!cart) throw notFound('Cart not found');
    return c.json(cartSummaryJson(cart));
  });

  api.post('/carts/:id/offers/refresh', async (c) => {
    const input = await optionalBody(c, refreshOffersSchema);
    const userId = c.get('userId');
    const offers = await refreshOffers(userId, uuidParam(c.req.param('id'), 'Cart'), {
      providers: input.providers,
      force: input.force,
    });
    if (!offers) throw notFound('Cart not found');
    const connections = await listConnections(userId);
    return c.json({
      offers: offers.map(offerJson),
      connections: Object.fromEntries(connections.map((conn) => [conn.provider, true])),
    });
  });

  api.post('/carts/:id/handoff/kroger', async (c) => {
    const result = await krogerHandoff(c.get('userId'), uuidParam(c.req.param('id'), 'Cart'));
    if (!result) throw notFound('Cart not found');
    return c.json({
      handoff_url: result.handoffUrl,
      pushed_count: result.pushedCount,
      skipped: result.skipped.map((s) => ({
        line_item_id: s.lineItemId,
        name: s.name,
        reason: s.reason,
      })),
      notes: result.notes,
    });
  });

  // Linked provider accounts ---------------------------------------------------

  api.get('/connections', async (c) => {
    const connections = await listConnections(c.get('userId'));
    return c.json({
      connections: connections.map((conn) => ({
        provider: conn.provider,
        connected_at: conn.connectedAt.toISOString(),
      })),
    });
  });

  api.delete('/connections/:provider', async (c) => {
    const provider = c.req.param('provider').toLowerCase();
    const removed = await deleteConnection(c.get('userId'), provider);
    if (!removed) throw notFound('Connection not found');
    return c.body(null, 204);
  });

  // Recipes (the shelf) -------------------------------------------------------------

  api.post('/recipes', async (c) => {
    const input = await body(c, ingestRecipeSchema);
    const result = await ingestRecipe({
      userId: c.get('userId'),
      householdId: input.household_id,
      url: input.url,
    });
    // Lane 2 art: kick generate->judge->cache in the background so the save
    // returns immediately. waitUntil keeps the serverless invocation alive on
    // Vercel; in local dev the promise just runs on the long-lived server.
    if (!result.alreadySaved && artConfigured()) {
      waitUntil(
        ensureRecipeArt(result.recipe.id).catch((err) =>
          console.error('Background art generation failed:', err),
        ),
      );
    }
    return c.json(
      { recipe: recipeJson(result.recipe), already_saved: result.alreadySaved },
      result.alreadySaved ? 200 : 201,
    );
  });

  api.get('/recipes', async (c) => {
    const limitRaw = c.req.query('limit');
    const limit = limitRaw === undefined ? undefined : Number(limitRaw);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
      throw validationError('limit must be a positive integer');
    }
    const listing = await listRecipes(c.get('userId'), {
      householdId: uuidQuery(c.req.query('household_id'), 'household_id'),
      limit,
    });
    return c.json({
      recipes: listing.recipes.map(recipeJson),
      cuisine_counts: listing.cuisineCounts,
    });
  });

  api.delete('/recipes/:id', async (c) => {
    const removed = await deleteRecipe(c.get('userId'), uuidParam(c.req.param('id'), 'Recipe'));
    if (!removed) throw notFound('Recipe not found');
    return c.body(null, 204);
  });

  // Ensure (or, with force=1, reroll) the generated art for one shelf save.
  // Idempotent: existing art returns immediately with status 'exists'.
  api.post('/recipes/:id/art', async (c) => {
    const force = ['1', 'true'].includes(c.req.query('force') ?? '');
    const result = await ensureRecipeArtForUser(
      c.get('userId'),
      uuidParam(c.req.param('id'), 'Recipe'),
      { force },
    );
    if (!result) throw notFound('Recipe not found');
    return c.json({ status: result.status, art_url: result.artUrl });
  });

  // MCP access tokens --------------------------------------------------------------

  api.post('/tokens', async (c) => {
    const input = await body(c, z.object({ name: z.string().min(1).max(120) }));
    const created = await createApiToken(c.get('userId'), input.name);
    return c.json(
      { id: created.id, name: created.name, token: created.token, created_at: created.createdAt.toISOString() },
      201,
    );
  });

  api.get('/tokens', async (c) => {
    const tokens = await listApiTokens(c.get('userId'));
    return c.json({
      tokens: tokens.map((t) => ({
        id: t.id,
        name: t.name,
        last_used_at: t.lastUsedAt?.toISOString() ?? null,
        created_at: t.createdAt.toISOString(),
      })),
    });
  });

  api.delete('/tokens/:id', async (c) => {
    await revokeApiToken(c.get('userId'), uuidParam(c.req.param('id'), 'Token'));
    return c.body(null, 204);
  });

  app.route('/api/v1', api);

  app.notFound((c) =>
    c.json({ error: { code: 'not_found', message: 'Route not found' } }, 404),
  );

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        { error: { code: err.code, message: err.message } },
        err.status as ContentfulStatusCode,
      );
    }
    console.error('Unhandled error:', err);
    return c.json(
      { error: { code: 'internal_error', message: 'Internal server error' } },
      500,
    );
  });

  return app;
}

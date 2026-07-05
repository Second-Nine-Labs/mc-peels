import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import { verifySupabaseToken } from '../auth/supabase';
import { createApiToken, listApiTokens, revokeApiToken } from '../auth/tokens';
import { createCart, getCartWithItems, listRecentCarts, markCartOpened } from '../core/carts';
import { AppError, notFound, unauthorized, validationError } from '../core/errors';
import {
  createHousehold,
  createInvite,
  getHouseholdDetail,
  getProfile,
  joinHousehold,
  listMemberships,
  putProfile,
  updateHousehold,
} from '../core/households';
import { listRetailers } from '../core/retailers';
import { HEALTH_FILTERS } from '../types';
import { mcpRoute } from '../mcp/route';
import {
  cartDetailJson,
  cartSummaryJson,
  householdJson,
  lineItemJson,
  profileJson,
  retailerJson,
} from './serializers';

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

const createHouseholdSchema = z.object({
  name: z.string().min(1).max(120),
  postal_code: z.string().min(3).max(10),
  country_code: z.enum(['US', 'CA']),
});

const patchHouseholdSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  postal_code: z.string().min(3).max(10).optional(),
  country_code: z.enum(['US', 'CA']).optional(),
  preferred_retailer_key: z.string().min(1).nullable().optional(),
});

const profileSchema = z.object({
  prefer_organic: z.boolean(),
  preferred_brands: z.array(z.string().min(1)).max(50),
  excluded_ingredients: z.array(z.string().min(1)).max(100),
  allergens: z.array(z.string().min(1)).max(100),
  health_filters: z.array(healthFilterEnum).max(HEALTH_FILTERS.length),
  notes: z.string().max(2000).nullable().optional(),
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
  retailer_key: z.string().min(1).optional(),
});

export function createApp() {
  const app = new Hono<Vars>();

  app.get('/health', (c) => c.json({ ok: true }));

  // MCP front door — authenticates with its own mcp_ bearer tokens.
  app.route('/mcp', mcpRoute);

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
    const detail = await getHouseholdDetail(c.get('userId'), c.req.param('id'));
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
    const household = await updateHousehold(c.get('userId'), c.req.param('id'), {
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
    const invite = await createInvite(c.get('userId'), c.req.param('id'));
    return c.json({ code: invite.code, expires_at: invite.expiresAt.toISOString() }, 201);
  });

  api.post('/households/join', async (c) => {
    const input = await body(c, z.object({ code: z.string().min(4).max(16) }));
    const household = await joinHousehold(c.get('userId'), input.code);
    return c.json(householdJson(household));
  });

  // Dietary profile -------------------------------------------------------------

  api.get('/households/:id/dietary-profile', async (c) => {
    const profile = await getProfile(c.get('userId'), c.req.param('id'));
    return c.json(profileJson(profile));
  });

  api.put('/households/:id/dietary-profile', async (c) => {
    const input = await body(c, profileSchema);
    const saved = await putProfile(c.get('userId'), c.req.param('id'), {
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
      householdId: c.req.query('household_id'),
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
      householdId: c.req.query('household_id'),
      limit,
    });
    return c.json({ carts: carts.map(cartSummaryJson) });
  });

  api.get('/carts/:id', async (c) => {
    const cart = await getCartWithItems(c.get('userId'), c.req.param('id'));
    if (!cart) throw notFound('Cart not found');
    return c.json(cartDetailJson(cart));
  });

  api.post('/carts/:id/opened', async (c) => {
    const cart = await markCartOpened(c.get('userId'), c.req.param('id'));
    if (!cart) throw notFound('Cart not found');
    return c.json(cartSummaryJson(cart));
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
    await revokeApiToken(c.get('userId'), c.req.param('id'));
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

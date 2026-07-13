/**
 * The MCP surface for agent clients like Third Brain's Chief of Staff
 * (PRD section 11). The surface stays tight: the household is resolved from
 * the authenticated user's token, the dietary profile is applied server-side
 * automatically, and purchases are never autonomous — every tool that builds
 * a cart returns a link a human must open and check out on Instacart.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createCart, getCartWithItems, listRecentCarts } from '../core/carts.js';
import { AppError } from '../core/errors.js';
import { getHouseholdContext } from '../core/households.js';
import { ingestRecipe, listRecipes } from '../core/recipes.js';
import { listRetailers } from '../core/retailers.js';
import {
  cartDetailJson,
  cartSummaryJson,
  householdJson,
  lineItemJson,
  profileJson,
  recipeJson,
  retailerJson,
} from '../http/serializers.js';

const ALLERGEN_CAVEAT =
  'Instacart health filters are preference signals for item selection, not safety ' +
  'guarantees: they do not certify any product is free of an allergen. The human ' +
  'review at Instacart checkout is the final safety gate. Never imply otherwise.';

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function toolError(err: unknown) {
  const message =
    err instanceof AppError
      ? `${err.code}: ${err.message}`
      : 'internal_error: something went wrong handling this tool call.';
  if (!(err instanceof AppError)) {
    console.error('MCP tool error:', err);
  }
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

export function buildMcpServer(userId: string): McpServer {
  const server = new McpServer({ name: 'mc-peels', version: '0.1.0' });

  server.registerTool(
    'mcpeels_create_cart',
    {
      title: 'Create an Instacart cart from a grocery request',
      description:
        'Turns a natural-language grocery request (request_text) OR a pre-structured ' +
        'list (line_items) into a ready-to-checkout Instacart shopping-list link for ' +
        "the caller's household. The household dietary profile (organic preference, " +
        'brands, allergens, health filters) is applied automatically server-side — do ' +
        'not pass or manage filters. Do NOT invent quantities the user did not state. ' +
        'The returned instacart_url must be delivered to the requester: a human opens ' +
        'it, reviews the cart, and checks out on Instacart with their own account — ' +
        'purchases are never autonomous. Use resolved_line_items and notes to tell ' +
        'the user exactly what filters were applied.',
      inputSchema: {
        request_text: z
          .string()
          .max(4000)
          .optional()
          .describe('Free-text grocery request, e.g. "organic bananas and grass-fed beef"'),
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
          .optional()
          .describe('Pre-structured items; provide exactly one of request_text or line_items'),
        retailer_key: z
          .string()
          .max(100)
          .optional()
          .describe("Overrides the household's preferred retailer for this cart"),
        household_id: z
          .string()
          .uuid()
          .optional()
          .describe('Only needed when the user belongs to multiple households'),
      },
    },
    async (args) => {
      try {
        const result = await createCart({
          userId,
          householdId: args.household_id,
          channel: 'mcp',
          requestText: args.request_text,
          lineItems: args.line_items,
          retailerKey: args.retailer_key,
        });
        return jsonResult({
          cart_id: result.cartId,
          instacart_url: result.instacartUrl,
          retailer: result.retailer ? retailerJson(result.retailer) : null,
          resolved_line_items: result.resolvedLineItems.map(lineItemJson),
          notes: result.notes,
          checkout: 'A human must open instacart_url, review the cart, and pay on Instacart.',
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    'mcpeels_list_retailers',
    {
      title: 'List nearby Instacart retailers',
      description:
        "Returns Instacart retailers near the household's postal code (or an explicit " +
        'postal_code). Useful for choosing or changing the preferred retailer.',
      inputSchema: {
        postal_code: z.string().min(3).max(10).optional(),
        household_id: z
          .string()
          .uuid()
          .optional()
          .describe('Only needed when the user belongs to multiple households'),
      },
    },
    async (args) => {
      try {
        const retailers = await listRetailers(userId, {
          householdId: args.household_id,
          postalCode: args.postal_code,
        });
        return jsonResult({ retailers: retailers.map(retailerJson) });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    'mcpeels_get_cart',
    {
      title: 'Get a cart with its line items',
      description:
        'Returns cart details: the Instacart checkout URL, best-effort local status ' +
        '(created/opened/expired — Instacart does not report real order state), and ' +
        'the resolved line items with the filters that were applied.',
      inputSchema: { cart_id: z.string().uuid() },
    },
    async (args) => {
      try {
        const cart = await getCartWithItems(userId, args.cart_id);
        if (!cart) return toolError(new AppError('not_found', 'Cart not found', 404));
        return jsonResult(cartDetailJson(cart));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    'mcpeels_list_recent_carts',
    {
      title: "List the household's recent carts",
      description: "Returns the household's recent carts, newest first.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
        household_id: z
          .string()
          .uuid()
          .optional()
          .describe('Only needed when the user belongs to multiple households'),
      },
    },
    async (args) => {
      try {
        const carts = await listRecentCarts(userId, {
          householdId: args.household_id,
          limit: args.limit,
        });
        return jsonResult({ carts: carts.map(cartSummaryJson) });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    'mcpeels_save_recipe',
    {
      title: 'Save a recipe link to the household shelf',
      description:
        'Ingests a recipe from a link — TikTok, Pinterest, Instagram, YouTube, or any ' +
        'recipe page — onto the household shelf. The server reads what the link honestly ' +
        'yields and extracts one structured recipe with Instacart-ready ingredients; when ' +
        'the source hides its content (common on Instagram), the dish is rebuilt from ' +
        "what's visible and marked provenance: 'reconstructed'. Surface the recipe's " +
        'notes and provenance to the user. Saving does not build a cart; the recipe ' +
        'becomes orderable from the shelf in the app.',
      inputSchema: {
        url: z.string().min(8).max(2048).describe('The shared link, as pasted'),
        household_id: z
          .string()
          .uuid()
          .optional()
          .describe('Only needed when the user belongs to multiple households'),
      },
    },
    async (args) => {
      try {
        const result = await ingestRecipe({
          userId,
          householdId: args.household_id,
          url: args.url,
        });
        return jsonResult({
          recipe: recipeJson(result.recipe),
          already_saved: result.alreadySaved,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    'mcpeels_list_shelf_recipes',
    {
      title: 'List the recipes on the household shelf',
      description:
        "Returns the household's saved recipes (newest first) plus per-cuisine counts. " +
        'Recipes carry cartable ingredients; a human orders them from the app.',
      inputSchema: {
        limit: z.number().int().min(1).max(200).optional(),
        household_id: z
          .string()
          .uuid()
          .optional()
          .describe('Only needed when the user belongs to multiple households'),
      },
    },
    async (args) => {
      try {
        const listing = await listRecipes(userId, {
          householdId: args.household_id,
          limit: args.limit,
        });
        return jsonResult({
          recipes: listing.recipes.map(recipeJson),
          cuisine_counts: listing.cuisineCounts,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    'mcpeels_get_household',
    {
      title: "Get the household's dietary profile and settings",
      description:
        "Read-only context: the caller's household, its dietary profile summary, and " +
        'preferred retailer — so an agent can explain why filters were applied. ' +
        'Includes the allergen-honesty caveat, which must be respected in any ' +
        'user-facing summary.',
      inputSchema: {
        household_id: z
          .string()
          .uuid()
          .optional()
          .describe('Only needed when the user belongs to multiple households'),
      },
    },
    async (args) => {
      try {
        const ctx = await getHouseholdContext(userId, args.household_id);
        return jsonResult({
          household: householdJson(ctx.household),
          dietary_profile: profileJson(ctx.profile),
          allergen_caveat: ALLERGEN_CAVEAT,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  return server;
}

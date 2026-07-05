import { randomInt } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import type { DietaryProfile, Household, HouseholdMember } from '../db/schema';
import {
  EMPTY_PROFILE,
  HEALTH_FILTERS,
  type DietaryProfileRules,
  type HealthFilter,
} from '../types';
import { conflict, forbidden, notFound, validationError } from './errors';

export interface HouseholdContext {
  household: Household;
  membership: HouseholdMember;
  profile: DietaryProfileRules;
}

export function profileRowToRules(row: DietaryProfile | null | undefined): DietaryProfileRules {
  if (!row) return EMPTY_PROFILE;
  return {
    preferOrganic: row.preferOrganic,
    preferredBrands: row.preferredBrands ?? [],
    excludedIngredients: row.excludedIngredients ?? [],
    allergens: row.allergens ?? [],
    // Drop anything that isn't a currently-supported Instacart health filter.
    healthFilters: (row.healthFilters ?? []).filter((f): f is HealthFilter =>
      (HEALTH_FILTERS as readonly string[]).includes(f),
    ),
    notes: row.notes,
  };
}

async function getProfileRow(householdId: string): Promise<DietaryProfile | undefined> {
  const rows = await getDb()
    .select()
    .from(schema.dietaryProfiles)
    .where(eq(schema.dietaryProfiles.householdId, householdId))
    .limit(1);
  return rows[0];
}

/**
 * Resolve the household a user is acting in (PRD sections 5, 14).
 * Without an explicit id: their single membership. Multiple memberships
 * require an explicit household_id so MCP calls resolve unambiguously.
 */
export async function getHouseholdContext(
  userId: string,
  householdId?: string,
): Promise<HouseholdContext> {
  const db = getDb();

  let membership: HouseholdMember | undefined;
  if (householdId) {
    const rows = await db
      .select()
      .from(schema.householdMembers)
      .where(
        and(
          eq(schema.householdMembers.householdId, householdId),
          eq(schema.householdMembers.userId, userId),
        ),
      )
      .limit(1);
    membership = rows[0];
    if (!membership) throw forbidden('You are not a member of this household');
  } else {
    const memberships = await db
      .select()
      .from(schema.householdMembers)
      .where(eq(schema.householdMembers.userId, userId));
    if (memberships.length === 0) {
      throw notFound('You have no household yet. Create one to get started.');
    }
    if (memberships.length > 1) {
      throw validationError(
        'You belong to multiple households; pass an explicit household_id.',
      );
    }
    membership = memberships[0]!;
  }

  const households = await db
    .select()
    .from(schema.households)
    .where(eq(schema.households.id, membership.householdId))
    .limit(1);
  const household = households[0];
  if (!household) throw notFound('Household not found');

  const profileRow = await getProfileRow(household.id);
  return { household, membership, profile: profileRowToRules(profileRow) };
}

export async function createHousehold(
  userId: string,
  input: { name: string; postalCode: string; countryCode: string },
): Promise<Household> {
  return getDb().transaction(async (tx) => {
    const [household] = await tx
      .insert(schema.households)
      .values({
        name: input.name,
        postalCode: input.postalCode,
        countryCode: input.countryCode,
        createdBy: userId,
      })
      .returning();
    await tx.insert(schema.householdMembers).values({
      householdId: household!.id,
      userId,
      role: 'owner',
    });
    // Empty profile from day one so "apply the dietary profile" is always defined.
    await tx.insert(schema.dietaryProfiles).values({ householdId: household!.id });
    return household!;
  });
}

export interface HouseholdPatch {
  name?: string;
  postalCode?: string;
  countryCode?: string;
  /** null clears the preference. */
  preferredRetailerKey?: string | null;
}

export async function updateHousehold(
  userId: string,
  householdId: string,
  patch: HouseholdPatch,
): Promise<Household> {
  const ctx = await getHouseholdContext(userId, householdId);
  if (Object.keys(patch).length === 0) return ctx.household;
  const [updated] = await getDb()
    .update(schema.households)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.households.id, householdId))
    .returning();
  return updated!;
}

export interface HouseholdDetail {
  household: Household;
  members: Array<{ userId: string; role: 'owner' | 'member'; joinedAt: Date }>;
  profile: DietaryProfileRules;
}

export async function getHouseholdDetail(
  userId: string,
  householdId: string,
): Promise<HouseholdDetail> {
  const ctx = await getHouseholdContext(userId, householdId);
  const members = await getDb()
    .select()
    .from(schema.householdMembers)
    .where(eq(schema.householdMembers.householdId, householdId));
  return {
    household: ctx.household,
    members: members.map((m) => ({ userId: m.userId, role: m.role, joinedAt: m.createdAt })),
    profile: ctx.profile,
  };
}

export async function listMemberships(userId: string) {
  return getDb()
    .select({ membership: schema.householdMembers, household: schema.households })
    .from(schema.householdMembers)
    .innerJoin(
      schema.households,
      eq(schema.householdMembers.householdId, schema.households.id),
    )
    .where(eq(schema.householdMembers.userId, userId));
}

// Invites --------------------------------------------------------------------

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  }
  return code;
}

export async function createInvite(userId: string, householdId: string) {
  await getHouseholdContext(userId, householdId);
  const [invite] = await getDb()
    .insert(schema.householdInvites)
    .values({
      householdId,
      code: generateInviteCode(),
      createdBy: userId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    })
    .returning();
  return { code: invite!.code, expiresAt: invite!.expiresAt };
}

export async function joinHousehold(userId: string, code: string): Promise<Household> {
  const db = getDb();
  const invites = await db
    .select()
    .from(schema.householdInvites)
    .where(eq(schema.householdInvites.code, code.trim().toUpperCase()))
    .limit(1);
  const invite = invites[0];
  if (!invite || invite.expiresAt.getTime() < Date.now()) {
    throw notFound('Invite code is invalid or expired');
  }

  const existing = await db
    .select()
    .from(schema.householdMembers)
    .where(
      and(
        eq(schema.householdMembers.householdId, invite.householdId),
        eq(schema.householdMembers.userId, userId),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    throw conflict('You are already a member of this household');
  }

  await db.insert(schema.householdMembers).values({
    householdId: invite.householdId,
    userId,
    role: 'member',
  });

  const households = await db
    .select()
    .from(schema.households)
    .where(eq(schema.households.id, invite.householdId))
    .limit(1);
  return households[0]!;
}

// Dietary profile --------------------------------------------------------------

export async function getProfile(
  userId: string,
  householdId: string,
): Promise<DietaryProfileRules> {
  const ctx = await getHouseholdContext(userId, householdId);
  return ctx.profile;
}

export async function putProfile(
  userId: string,
  householdId: string,
  rules: DietaryProfileRules,
): Promise<DietaryProfileRules> {
  await getHouseholdContext(userId, householdId);
  const invalid = rules.healthFilters.filter(
    (f) => !(HEALTH_FILTERS as readonly string[]).includes(f),
  );
  if (invalid.length > 0) {
    throw validationError(`Unsupported health filters: ${invalid.join(', ')}`);
  }

  const values = {
    householdId,
    preferOrganic: rules.preferOrganic,
    preferredBrands: rules.preferredBrands,
    excludedIngredients: rules.excludedIngredients,
    allergens: rules.allergens,
    healthFilters: rules.healthFilters,
    notes: rules.notes,
    updatedAt: new Date(),
  };
  const [saved] = await getDb()
    .insert(schema.dietaryProfiles)
    .values(values)
    .onConflictDoUpdate({ target: schema.dietaryProfiles.householdId, set: values })
    .returning();
  return profileRowToRules(saved);
}

/** Matches `AuthUser` in api.ts — kept local to avoid circular imports. */
export type NormalizedUser = {
  id: string;
  email: string;
  name?: string;
  image?: string;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Strip "Bearer " if the API returns the full scheme. */
function normalizeBearerValue(raw: string): string {
  const t = raw.trim();
  if (t.toLowerCase().startsWith('bearer ')) return t.slice(7).trim();
  return t;
}

function pickToken(obj: UnknownRecord, depth = 0): string | undefined {
  if (depth > 4) return undefined;
  const keys = ['accessToken', 'access_token', 'token', 'jwt', 'idToken', 'id_token'] as const;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.length > 0) return normalizeBearerValue(v);
  }
  const nested = obj.data;
  if (isRecord(nested)) {
    const t = pickToken(nested, depth + 1);
    if (t) return t;
  }
  return undefined;
}

function pickUser(obj: UnknownRecord, depth = 0): NormalizedUser | undefined {
  if (depth > 4) return undefined;
  const raw = obj.user ?? obj.profile;
  if (isRecord(raw)) {
    const id = raw.id ?? raw.sub;
    const email = raw.email;
    if ((typeof id === 'string' || typeof id === 'number') && typeof email === 'string') {
      return {
        id: String(id),
        email,
        name: typeof raw.name === 'string' ? raw.name : undefined,
        image: typeof raw.image === 'string' ? raw.image : undefined,
      };
    }
    if (typeof email === 'string' && email.length > 0) {
      return {
        id: typeof id === 'string' || typeof id === 'number' ? String(id) : email,
        email,
        name: typeof raw.name === 'string' ? raw.name : undefined,
        image: typeof raw.image === 'string' ? raw.image : undefined,
      };
    }
  }
  if (typeof obj.email === 'string' && obj.email.length > 0) {
    return {
      id: typeof obj.id === 'string' || typeof obj.id === 'number' ? String(obj.id) : obj.email,
      email: obj.email,
      name: typeof obj.name === 'string' ? obj.name : undefined,
    };
  }
  const nested = obj.data;
  if (isRecord(nested)) return pickUser(nested, depth + 1);
  return undefined;
}

/**
 * Maps common backend shapes (camelCase, snake_case, nested `data`) to what the app expects.
 */
/** Use after refresh endpoint when only a token is returned. */
export function normalizeRefreshResponse(data: unknown): { accessToken: string } {
  if (!isRecord(data)) {
    throw new Error('Invalid refresh response');
  }
  const accessToken = pickToken(data);
  if (!accessToken) {
    throw new Error('Refresh response missing access token');
  }
  return { accessToken };
}

export function normalizeAuthResponse(
  data: unknown,
  fallbackEmail?: string,
): { accessToken: string; user: NormalizedUser } {
  if (!isRecord(data)) {
    throw new Error('Invalid auth response');
  }

  const accessToken = pickToken(data);
  if (!accessToken) {
    throw new Error('Auth response missing access token (expected accessToken, access_token, or token)');
  }

  let user = pickUser(data);
  if (!user && fallbackEmail) {
    user = {
      id: 'pending',
      email: fallbackEmail,
    };
  }
  if (!user) {
    throw new Error('Auth response missing user');
  }

  return { accessToken, user };
}

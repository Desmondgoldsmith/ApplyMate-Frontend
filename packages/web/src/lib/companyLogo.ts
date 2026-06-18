export type CompanyLogoSource =
  | 'posting_dom'
  | 'discovery_listing'
  | 'favicon'
  | 'open_graph'
  | 'site_selector'
  | 'manual';

export function companyInitial(company: string): string {
  const t = company.trim();
  if (!t) return '?';
  return t.charAt(0).toUpperCase();
}

/** Read persisted logo from owned-job payloads (camelCase or snake_case). */
export function readCompanyLogo(row: {
  companyLogoUrl?: string | null;
  company_logo_url?: string | null;
  logoUrl?: string | null;
  logo_url?: string | null;
}): string | null {
  const candidates = [
    row.companyLogoUrl,
    row.company_logo_url,
    row.logoUrl,
    row.logo_url,
  ];
  for (const raw of candidates) {
    if (raw === null || raw === undefined) continue;
    const trimmed = String(raw).trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function pickCompanyLogoUrl(o: Record<string, unknown>): string | null {
  return readCompanyLogo({
    companyLogoUrl: o.companyLogoUrl as string | null | undefined,
    company_logo_url: o.company_logo_url as string | null | undefined,
    logoUrl: o.logoUrl as string | null | undefined,
    logo_url: o.logo_url as string | null | undefined,
  });
}

export function pickCompanyLogoSource(
  o: Record<string, unknown>,
): CompanyLogoSource | null | undefined {
  const raw = o.companyLogoSource ?? o.company_logo_source;
  if (raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const allowed: CompanyLogoSource[] = [
    'posting_dom',
    'discovery_listing',
    'favicon',
    'open_graph',
    'site_selector',
    'manual',
  ];
  return allowed.includes(trimmed as CompanyLogoSource)
    ? (trimmed as CompanyLogoSource)
    : undefined;
}

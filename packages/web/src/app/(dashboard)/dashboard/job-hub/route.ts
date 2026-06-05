import { NextRequest, NextResponse } from 'next/server';

import { buildJobHubAliasRedirect } from '@/lib/dashboardCanonicalRoutes';

/** Permanent redirect — bookmarked `/dashboard/job-hub` links. */
export function GET(request: NextRequest) {
  const dest = buildJobHubAliasRedirect(request.nextUrl.searchParams);
  return NextResponse.redirect(new URL(dest, request.url), 301);
}

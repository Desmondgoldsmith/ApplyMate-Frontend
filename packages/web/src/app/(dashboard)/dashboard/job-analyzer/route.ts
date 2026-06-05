import { NextRequest, NextResponse } from 'next/server';

import { buildJobAnalyzerAliasRedirect } from '@/lib/dashboardCanonicalRoutes';

/** Permanent redirect — bookmarked `/dashboard/job-analyzer` links. */
export function GET(request: NextRequest) {
  const dest = buildJobAnalyzerAliasRedirect(request.nextUrl.searchParams);
  return NextResponse.redirect(new URL(dest, request.url), 301);
}

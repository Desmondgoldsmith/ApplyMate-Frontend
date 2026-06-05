import { NextRequest, NextResponse } from 'next/server';

import { buildInterviewPrepAliasRedirect } from '@/lib/dashboardCanonicalRoutes';

/** Permanent redirect — bookmarked `/dashboard/interview-prep` links. */
export function GET(request: NextRequest) {
  const dest = buildInterviewPrepAliasRedirect(request.nextUrl.searchParams);
  return NextResponse.redirect(new URL(dest, request.url), 301);
}

import { NextRequest, NextResponse } from 'next/server';

/** Permanent redirect — bookmarked `/dashboard/job-archive` links. */
export function GET(request: NextRequest) {
  const dest = `/dashboard/jobs/archive${request.nextUrl.search}`;
  return NextResponse.redirect(new URL(dest, request.url), 301);
}

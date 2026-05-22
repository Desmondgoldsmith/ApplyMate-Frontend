'use client';

import { createContext, type RefObject } from 'react';

/** Ref to `<main>` so overlays (e.g. expanded CV editor) can portal into the content area, not under the header. */
export const DashboardMainContext = createContext<RefObject<HTMLElement | null> | null>(null);

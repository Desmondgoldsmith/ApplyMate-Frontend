import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// findBy* / waitFor give up after 1s by default; a full parallel run (or CI) can take longer to
// render, click and settle a mocked request. Passing tests still resolve as soon as they can.
configure({ asyncUtilTimeout: 5_000 });

/**
 * @file Vercel Web Analytics Integration
 * @description Initializes Vercel Web Analytics for tracking page views and events
 */

import { inject } from '@vercel/analytics';

// Initialize Vercel Web Analytics
inject();

export { inject };

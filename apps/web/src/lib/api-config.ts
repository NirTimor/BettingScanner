/**
 * Central API and auth config for the web app.
 * Set NEXT_PUBLIC_API_URL in .env for production.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export const TOKEN_KEY = 'bettingScannerToken';

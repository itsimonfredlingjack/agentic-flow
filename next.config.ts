import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers for all routes
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Content Security Policy - restricts resource loading
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Allow scripts from self, eval and inline for development (needed by Next.js HMR)
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              // Allow inline styles (needed for Tailwind/glassmorphism) and self-hosted styles
              "style-src 'self' 'unsafe-inline'",
              // Images from self and data URIs
              "img-src 'self' data: blob:",
              // Fonts from self
              "font-src 'self'",
              // Connect to self (API), localhost, LAN, and websockets for HMR
              "connect-src 'self' http://localhost:* ws://localhost:* http://192.168.86.36:* ws://192.168.86.36:*",
              // Block plugins (Flash, etc.)
              "object-src 'none'",
              // Base URI restriction
              "base-uri 'self'",
              // Form action restriction
              "form-action 'self'",
              // Frame ancestors - prevent clickjacking
              "frame-ancestors 'none'",
            ].join('; '),
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Clickjacking protection
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // XSS protection (legacy browsers)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Referrer policy - don't leak referrer to external sites
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permissions policy - disable unnecessary browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

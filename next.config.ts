import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // It's generally good practice to address TypeScript errors during local development.
    // You can set this to false or remove it to ensure errors are caught.
    ignoreBuildErrors: false,
  },
  eslint: {
    // Similar to TypeScript, catching ESLint errors during local dev helps maintain code quality.
    // Set to false or remove to ensure errors are caught.
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Add your local development origins here
  allowedDevOrigins: [
    'http://localhost:3000', // Common port for Next.js development server
    'http://127.0.0.1:3000', // Another common local host address
    // You can keep the cloud workstation origin if you sometimes use it for local-like testing
    'https://6000-firebase-studio-1751798318395.cluster-3gc7bglotjgwuxlqpiut7yyqt4.cloudworkstations.dev',
  ],
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
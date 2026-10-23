/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // Keep API request slashes intact so Django never needs to redirect a POST.
  skipTrailingSlashRedirect: true,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    const apiBaseUrl = (
      process.env.API_INTERNAL_BASE_URL || "http://localhost:8000"
    ).replace(/\/$/, "");

    return [
      {
        source: "/api/:path*",
        // Next's catch-all rewrite can drop the matched trailing slash.
        // Add it back before forwarding every request to Django.
        destination: `${apiBaseUrl}/:path*/`,
      },
    ];
  },
};

export default nextConfig;

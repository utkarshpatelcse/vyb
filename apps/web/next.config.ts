import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@vyb/app-core",
    "@vyb/contracts",
    "@vyb/design-tokens",
    "@vyb/ui-web"
  ]
};

export default nextConfig;

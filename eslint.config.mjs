import { createRequire } from "module";

const require = createRequire(import.meta.url);

/** @type {import("eslint").Linter.Config[]} */
const nextConfig = require("eslint-config-next");

const config = [
  {
    ignores: [
      "infra/cdk.out/**",
      "infra/node_modules/**",
      "out/**",
      ".next/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
    ],
  },
  ...nextConfig,
];

export default config;

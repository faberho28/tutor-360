import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Simulated data stays behind /demo: only these places may import it.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "app/demo/**",
      "components/demo/**",
      "lib/fixtures/**",
      "lib/services/demo.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/fixtures/**",
                "**/components/demo/**",
                "**/services/demo",
              ],
              message:
                "Simulated data is only for /demo. Use useServices() instead of importing fixtures.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

// Shared flat ESLint config for the Ledgr monorepo.
// Consumed as: import { base, noDatabaseAccess } from "@ledgr/config/eslint";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export const base = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: ["dist/**", ".next/**", "generated/**", "node_modules/**", "coverage/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];

/**
 * Enforces the architectural boundary from PROJECT.md: the web app is one client
 * of the Core API, never a database client. If the frontend can reach Prisma
 * directly, "a native app later is just another client" stops being true —
 * business logic leaks into the UI layer and has to be rewritten per client.
 *
 * This is a load-bearing rule, not style policing. Do not relax it to unblock a
 * feature; add the endpoint to the Core API instead.
 */
export const noDatabaseAccess = {
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@ledgr/db",
            message:
              "apps/web must not access the database directly. Call the Core API (apps/api) instead — see docs/adr/0002-three-layer-architecture.md.",
          },
          {
            name: "@prisma/client",
            message:
              "apps/web must not access the database directly. Call the Core API (apps/api) instead.",
          },
        ],
        patterns: [
          {
            group: ["@ledgr/db/*", "**/packages/db/**"],
            message:
              "apps/web must not access the database directly. Call the Core API (apps/api) instead.",
          },
        ],
      },
    ],
  },
};

export default base;

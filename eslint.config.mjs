import pluginNext from "@next/eslint-plugin-next";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default [
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "@next/next": pluginNext,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      // Next.js recommended rules
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs["core-web-vitals"].rules,

      // Basic TypeScript rules - more lenient for development
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",

      // General code quality rules - prioritize errors over warnings
      "no-console": "warn",
      "no-debugger": "error",
      "prefer-const": "warn",
      "no-var": "error",
      
      // Additional development-friendly rules
      "@typescript-eslint/no-empty-function": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["**/*.{js,jsx}"],
    rules: {
      // Disable TypeScript-specific rules for JS files
      "@typescript-eslint/no-var-requires": "off",
    },
  },
  {
    files: ["scripts/**/*.{js,ts}", "scripts/**/*.{jsx,tsx}"],
    rules: {
      // Allow operational scripts to log output and use flexible types
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-function": "off",
    },
  },
  {
    files: ["**/*.test.{js,jsx,ts,tsx}", "**/__tests__/**/*.{js,jsx,ts,tsx}", "**/cypress/**/*.{js,jsx,ts,tsx}"],
    rules: {
      // More lenient rules for test files
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "prefer-const": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "dist/**",
      "build/**",
      "*.config.js",
      "*.config.mjs",
      "coverage/**",
      "cypress/**",
      "public/**",
      ".firebase/**",
      ".vscode/**",
      "*.d.ts",
      "**/*.min.js",
      "**/vendor/**",
      "**/lib/vendor/**",
    ],
  },
];

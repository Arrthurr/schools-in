/** @type {import('jest').Config} */
module.exports = {
  // Rules tests are Node-only (no JSDOM, no Next.js runtime)
  testEnvironment: "node",

  // Only run emulator/rules tests in /tests
  testMatch: ["<rootDir>/tests/*.rules.test.js"],

  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
};


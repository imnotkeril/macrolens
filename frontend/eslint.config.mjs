import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextCoreWebVitals,
  {
    // React-Compiler-oriented rules added in eslint-plugin-react-hooks 7: advisory until the
    // existing components are refactored (code predates them and works).
    rules: {
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
    },
  },
  { ignores: ["node_modules/", ".next/", "out/"] },
];

export default config;

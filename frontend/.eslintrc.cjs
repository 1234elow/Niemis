module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  extends: ["eslint:recommended", "plugin:react/recommended"],
  plugins: ["react", "react-hooks"],
  rules: {
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-prototype-builtins": "off",
    "no-useless-catch": "off",
    "no-useless-escape": "off",
    "react/no-unescaped-entities": "off",
    "no-console": "off",
  },
  overrides: [
    {
      files: ["**/*.test.js", "**/*.test.jsx", "**/*.spec.js", "**/*.spec.jsx"],
      env: {
        jest: true,
      },
    },
  ],
};

module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  extends: [
    'airbnb-base', 
    'prettier',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 11,
    sourceType: 'module',
  },
  rules: {
    semi: ['error', 'never'],
    camelcase: false,
  },
};

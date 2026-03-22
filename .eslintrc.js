module.exports = {
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    extends: [
        'eslint:recommended',
        '@typescript-eslint/recommended',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    plugins: [
        '@typescript-eslint',
    ],
    rules: {
        // AI-friendly rules - focus on readability and maintainability
        'no-unused-vars': 'warn',
        '@typescript-eslint/no-unused-vars': 'warn',
        'no-console': 'off', // Allow console for debugging
        'prefer-const': 'error',
        'no-var': 'error',

        // Performance considerations
        'no-loop-func': 'warn',
        'no-sequences': 'warn',

        // Code clarity for AI parsing
        'max-len': ['warn', { code: 100 }],
        'complexity': ['warn', 10],
        'max-params': ['warn', 4],

        // WebGPU/WASM specific
        'no-bitwise': 'off', // Allow bitwise ops for performance
        'no-loss-of-precision': 'warn', // Important for floating point
    },
    ignorePatterns: [
        'node_modules/',
        'dist/',
        'build/',
        'projects/*/node_modules/',
        'projects/*/dist/',
        'projects/*/build/',
        'emsdk/',
        '*.wasm',
    ],
};
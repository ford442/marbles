module.exports = {
    root: true,
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    plugins: [
        '@typescript-eslint',
    ],
    globals: {
        Filament: 'readonly',
        GPUBufferUsage: 'readonly',
        GPUMapMode: 'readonly',
        GPUTextureUsage: 'readonly',
    },
    rules: {
        'no-empty': ['error', { allowEmptyCatch: true }],
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'warn',
        'no-console': 'off',
        'prefer-const': 'error',
        'no-var': 'error',
        'no-loop-func': 'warn',
        'no-sequences': 'warn',
        'max-len': ['warn', { code: 100 }],
        complexity: ['warn', 10],
        'max-params': ['warn', 4],
        'no-bitwise': 'off',
        'no-loss-of-precision': 'warn',
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
    },
    overrides: [
        {
            files: ['src/rendering/simple-debug-renderer.js'],
            rules: {
                'no-dupe-keys': 'off',
                'no-dupe-class-members': 'off',
            },
        },
        {
            files: ['tests/**/*.js', 'scripts/**/*.js', 'scripts/**/*.cjs'],
            rules: {
                '@typescript-eslint/no-unused-vars': 'off',
                'max-len': 'off',
                complexity: 'off',
            },
        },
    ],
    ignorePatterns: [
        'node_modules/',
        'dist/',
        'build/',
        'wasm/build/',
        'docs/backups/',
        'emsdk/',
        '*.wasm',
    ],
};

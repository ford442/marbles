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
        GPUShaderStage: 'readonly',
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
        '@typescript-eslint/ban-ts-comment': 'off',
        // All ray queries go through the typed facade, which owns Rapier's
        // castRay argument order and normalises timeOfImpact → toi.
        'no-restricted-syntax': ['error', {
            selector: 'CallExpression[callee.property.name=/^(castRay|castRayAndGetNormal|intersectionsWithRay)$/]'
                + ':not([callee.object.property.name="physicsQueries"])'
                + ':not([callee.object.name=/^(physicsQueries|queries)$/])',
            message: 'Cast rays through game.physicsQueries (src/game/systems/physics-queries.ts), '
                + 'not Rapier directly.',
        }],
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
            // The facade and the backends implement the queries.
            files: [
                'src/game/systems/physics-queries.ts',
                'src/game/systems/physics-backend.ts',
            ],
            rules: { 'no-restricted-syntax': 'off' },
        },
        {
            // `declare global { var … }` is the only way to type globals.
            files: ['**/*.d.ts'],
            rules: { 'no-var': 'off' },
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

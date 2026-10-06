import tseslint from 'typescript-eslint';
export default [
 { ignores: ['dist/**', 'node_modules/**', '.wrangler/**'] },
 ...tseslint.configs.recommended,
 { rules: { '@typescript-eslint/no-explicit-any': 'off' } }
];

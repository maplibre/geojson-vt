import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,

  {
    rules: {
        // HM TODO: remove this!
        "@typescript-eslint/no-explicit-any": "off"
    }
  }
);
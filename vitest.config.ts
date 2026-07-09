import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/main/platform/bootstrap.ts',
        'src/main/platform/config/**/*.ts',
        'src/main/platform/di/**/*.ts',
        'src/main/platform/errors/**/*.ts',
        'src/main/platform/ipc/{ipc-router,middleware,runtime.endpoint}.ts',
        'src/main/platform/logging/**/*.ts',
        'src/main/platform/permissions/**/*.ts',
        'src/main/platform/tokens.ts',
        'src/main/services/tokens.ts',
        'src/shared/platform/**/*.ts',
        'src/main/conversation/**/*.ts',
        'src/main/desktop/ipc/**/*.ts',
        'src/main/desktop/service/desktop-automation-service.ts',
        'src/main/documents/**/*.ts',
        'src/main/memory/**/*.ts',
        'src/main/office/**/*.ts',
        'src/main/plugins/**/*.ts',
        'src/main/production/**/*.ts',
        'src/main/release/**/*.ts',
        'src/main/web/**/*.ts',
        'src/shared/desktop/**/*.ts',
        'src/shared/plugins/**/*.ts',
        'src/shared/production/**/*.ts',
        'src/shared/release/**/*.ts',
        'src/shared/web/**/*.ts',
      ],
      thresholds: {
        branches: 95,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
});

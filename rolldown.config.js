import { defineConfig } from 'rolldown'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    preserveModules: true,
    preserveModulesRoot: 'src',
    target: 'esnext'
  },
  external: ['p-retry', 'retry'],
  resolve: {
    extensions: ['.ts', '.js']
  }
})
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  build: {
    // Off in production: shipped .map files would publish the full source of
    // the app to anyone who asks for them.
    sourcemap: false,
  },
  plugins: [
    react({
      babel: {
        plugins: [
          // Editor-only inspector. In a production bundle it stamps internal
          // file paths and line numbers into the DOM of every visitor, so it
          // must not survive the build.
          ...(command === 'serve' ? ['react-dev-locator'] : []),
        ],
      },
    }),
    tsconfigPaths()
  ],
}))

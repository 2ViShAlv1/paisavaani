import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Mount the same serverless handler in dev so `npm run dev` mirrors Vercel.
const apiDev = () => ({
  name: 'api-dev',
  configureServer(server) {
    server.middlewares.use('/api/ai', async (req, res) => {
      const mod = await server.ssrLoadModule('/api/ai.js');
      return mod.default(req, res);
    });
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), apiDev()],
});

const { resolve } = require('node:path');
const { cp, mkdir } = require('node:fs/promises');
const { defineConfig, loadEnv } = require('vite');
const stockApi = require('./api/stock.js');
const sportsApi = require('./api/sports.js');
const spotifyApi = require('./api/spotify.js');
const previewApi = require('./api/preview.js');

const pages = [
  'index.html',
  'classic.html',
  'one.html',
  'home-lotus.html',
  'projects.html',
  'about.html',
  'experience.html',
  'contact.html',
  'interests.html',
  'amazon.html',
  'portfolio.html',
  'intelligence.html',
];

module.exports = defineConfig(({ mode }) => {
  /* Spotify keys live in .env.local (never committed); load them so /api/spotify works locally.
     Values put there by an earlier load are cleared first, so edits to .env.local apply on reload. */
  for (const key of globalThis.__keysFromEnvFile || []) delete process.env[key];
  for (const key of Object.keys(process.env)) if (key.startsWith('SPOTIFY_') && !process.env[key]) delete process.env[key];
  const fileEnv = loadEnv(mode, __dirname, 'SPOTIFY_');
  globalThis.__keysFromEnvFile = Object.keys(fileEnv).filter((key) => !(key in process.env));
  Object.assign(process.env, fileEnv);
  return {
  appType: 'mpa',
  plugins: [
    {
      // Serves /api/stock locally; in production the same file runs as a serverless function.
      name: 'stock-api',
      configureServer(server) { server.middlewares.use('/api/stock', stockApi); server.middlewares.use('/api/sports', sportsApi); server.middlewares.use('/api/spotify', spotifyApi); server.middlewares.use('/api/preview', previewApi); },
      configurePreviewServer(server) { server.middlewares.use('/api/stock', stockApi); server.middlewares.use('/api/sports', sportsApi); server.middlewares.use('/api/spotify', spotifyApi); server.middlewares.use('/api/preview', previewApi); },
    },
    {
      name: 'copy-static-root-assets',
      async writeBundle(options) {
        const outDir = resolve(__dirname, options.dir || 'dist');
        await mkdir(outDir, { recursive: true });

        await Promise.all([
          cp(resolve(__dirname, 'site.js'), resolve(outDir, 'site.js')),
          cp(resolve(__dirname, 'chat.js'), resolve(outDir, 'chat.js')),
          cp(resolve(__dirname, 'one.js'), resolve(outDir, 'one.js')),
          cp(resolve(__dirname, 'signal.js'), resolve(outDir, 'signal.js')),
          cp(resolve(__dirname, 'signal.css'), resolve(outDir, 'signal.css')),
          cp(resolve(__dirname, 'chat.css'), resolve(outDir, 'chat.css')),
          cp(resolve(__dirname, 'one.css'), resolve(outDir, 'one.css')),
          cp(resolve(__dirname, 'market.js'), resolve(outDir, 'market.js')),
          cp(resolve(__dirname, 'interests.js'), resolve(outDir, 'interests.js')),
          cp(resolve(__dirname, 'turntable.js'), resolve(outDir, 'turntable.js')),
          cp(resolve(__dirname, 'logos'), resolve(outDir, 'logos'), { recursive: true }),
          cp(resolve(__dirname, 'vendor'), resolve(outDir, 'vendor'), { recursive: true }),
          cp(resolve(__dirname, 'Meet-Bhojani-Resume.pdf'), resolve(outDir, 'Meet-Bhojani-Resume.pdf')),
          cp(resolve(__dirname, 'meet-bhojani.jpg'), resolve(outDir, 'meet-bhojani.jpg')),
          cp(resolve(__dirname, 'meet-bhojani-portrait.jpg'), resolve(outDir, 'meet-bhojani-portrait.jpg')),
          cp(resolve(__dirname, 'first.css'), resolve(outDir, 'first.css')),
          cp(resolve(__dirname, 'glass.css'), resolve(outDir, 'glass.css')),
          cp(resolve(__dirname, 'motion.css'), resolve(outDir, 'motion.css')),
          cp(resolve(__dirname, 'refinement.css'), resolve(outDir, 'refinement.css')),
        ]);
      },
    },
  ],
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        pages.map((page) => [page.replace(/\.html$/, ''), resolve(__dirname, page)]),
      ),
    },
  },
  };
});

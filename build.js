const esbuild = require('esbuild');
const jsxPlugin = require('esbuild-plugin-jsx');

esbuild.build({
  entryPoints: ['src/index.jsx'],
  bundle: true,
  outfile: 'dist/bundle.js',
  minify: true,
  sourcemap: true,
  target: ['chrome120', 'firefox120', 'safari16', 'edge120'],
  plugins: [jsxPlugin()],
}).catch(() => process.exit(1));

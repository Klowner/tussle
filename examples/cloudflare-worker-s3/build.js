import path from "path";
import { fileURLToPath } from "url";
import { build } from "esbuild";
// import { createRequire } from 'module';
// const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  // Bundle the front-end code which will be imported by
  // the worker code as text.
  await build({
    bundle: true,
    format: "iife",
    entryPoints: [path.join(__dirname, 'src', "client.js")],
    outfile: path.join(__dirname, 'dist', 'client.js.gen'),
    logLevel: 'info',
  });

  // Bundle up the Cloudflare worker module.
  await build({
    bundle: true,
    sourcemap: 'inline',
    format: "esm",
    target: "esnext",
    entryPoints: [path.join(__dirname, "src", "worker.ts")],
    outdir: path.join(__dirname, "dist"),
    outExtension: { ".js": ".mjs" },
    plugins: [],
    loader: {
      '.html': 'text',
      '.gen': 'text',
    },
    logLevel: 'info',
  });
} catch (e) {
  console.error(e);
  process.exitCode = 1;
}

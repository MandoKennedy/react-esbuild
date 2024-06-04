import express from "express";
import dotenv from "dotenv";
import * as esbuild from "esbuild";
import chokidar from "chokidar";
import fs from "fs-extra";
import svgr from "esbuild-plugin-svgr";
import { sassPlugin as sass } from "esbuild-sass-plugin";
import { join } from "path";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const WebSocket = require("ws");

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

const wss = new WebSocket.Server({ noServer: true });
app.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (socket) => {
    wss.emit("connection", socket, request);
  });
});

wss.on("connection", (ws) => {
  console.log("Client connected for live reloading");
  ws.on("close", () => console.log("Client disconnected"));
});

function notifyClients() {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send("reload");
    }
  });
}

function updateHtml(bundlePath, htmlTemplatePath, outputHtmlPath) {
  const scriptTag = `<script src="${bundlePath}"></script>`;
  let htmlContent = fs.readFileSync(htmlTemplatePath, "utf8");
  htmlContent = htmlContent.replace("</body>", `${scriptTag}</body>`);
  fs.writeFileSync(outputHtmlPath, htmlContent);
}

function copyAssets(source, destination) {
  fs.copy(source, destination)
    .then(() => console.log(`Copied from ${source} to ${destination}`))
    .catch((err) =>
      console.error(
        `Error copying files from ${source} to ${destination}:`,
        err
      )
    );
}

function build(isProduction = false) {
  const outDir = isProduction ? "dist" : "public";
  esbuild
    .build({
      entryPoints: [join("src", "index.jsx")],
      bundle: true,
      outfile: `${outDir}/bundle.js`,
      plugins: [svgr(), sass()],
      minify: isProduction,
      sourcemap: !isProduction,
      define: {
        "process.env.NODE_ENV": `"${process.env.NODE_ENV}"`,
      },
    })
    .then(() => {
      updateHtml("bundle.js", "src/index.html", `${outDir}/index.html`);
      // copyAssets("src/assets", `${outDir}/assets`);
      // copyAssets("src/data", `${outDir}/data`);
      notifyClients(); // Notify clients to reload after build
    })
    .catch((error) => {
      console.error("Build failed:", error);
    });
}

if (process.env.NODE_ENV === "development") {
  build();
  app.use(express.static("public"));
  app.listen(port, () => {
    console.log(`Development server running at http://localhost:${port}`);
    // Setup watchers for assets, data folders and source files
    const watcher = chokidar.watch(["src/**/*"]);
    watcher.on("change", (path) => {
      console.log(`File ${path} has been changed, rebuilding...`);
      build(); // Trigger rebuild and re-copy assets
    });
  });
} else {
  build(true);
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
});
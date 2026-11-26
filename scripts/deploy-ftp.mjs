#!/usr/bin/env node
// Deploy the built site to InfinityFree (or any FTP host).
//
//   node scripts/deploy-ftp.mjs          # upload dist/ to the remote dir
//   node scripts/deploy-ftp.mjs --check  # connect and list only, no upload
//   node scripts/deploy-ftp.mjs --prune  # also drop stale files from assets/
//
// Credentials are read from .env.deploy.local (gitignored) or the environment:
//   FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_REMOTE_DIR (default "htdocs")

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve, sep } from "node:path";
import { Client } from "basic-ftp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Every file under a directory, recursively. */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function loadEnv() {
  const file = resolve(root, ".env.deploy.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const host = process.env.FTP_HOST;
const user = process.env.FTP_USER;
const password = process.env.FTP_PASSWORD;
const remoteDir = process.env.FTP_REMOTE_DIR ?? "htdocs";
const localDir = resolve(root, "dist");
const checkOnly = process.argv.includes("--check");
const prune = process.argv.includes("--prune");

if (!host || !user || !password) {
  console.error("Missing FTP_HOST / FTP_USER / FTP_PASSWORD (see .env.deploy.local).");
  process.exit(1);
}
if (!checkOnly && !existsSync(localDir)) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}

const client = new Client(30_000);

try {
  await client.access({ host, user, password, secure: false });
  console.log(`Connected to ${host} as ${user}.`);
  console.log(`Remote ${remoteDir}/ currently contains:`);
  for (const item of await client.list(remoteDir)) {
    console.log(`  ${item.isDirectory ? "d" : "-"} ${item.name}`);
  }
  try {
    console.log(`Remote ${remoteDir}/assets/ currently contains:`);
    for (const item of await client.list(`${remoteDir}/assets`)) {
      console.log(`  ${item.isDirectory ? "d" : "-"} ${item.name}`);
    }
  } catch {
    // assets/ may not exist on a first deploy.
  }

  if (!checkOnly) {
    console.log(`\nUploading dist/ -> ${remoteDir}/ ...`);
    await client.uploadFromDir(localDir, remoteDir);

    // Read every file back and compare byte counts, so a truncated transfer
    // can never be mistaken for a successful deploy.
    const files = walk(localDir);
    const mismatches = [];
    for (const localPath of files) {
      const rel = relative(localDir, localPath).split(sep).join("/");
      const remoteSize = await client.size(`${remoteDir}/${rel}`);
      const localSize = statSync(localPath).size;
      if (remoteSize !== localSize) {
        mismatches.push(`${rel}: local ${localSize} vs remote ${remoteSize}`);
      }
    }

    if (mismatches.length) {
      console.error(`Upload finished with ${mismatches.length} size mismatch(es):`);
      for (const line of mismatches) console.error(`  ${line}`);
      process.exitCode = 1;
    } else {
      console.log(`Upload complete. Verified ${files.length} files match.`);
    }
  }

  // The hashed bundles change on every build; drop the ones this build no
  // longer references so htdocs/assets does not grow without bound.
  const assetsDir = resolve(localDir, "assets");
  if (prune && existsSync(assetsDir)) {
    const keep = new Set(
      walk(assetsDir).map((path) => relative(assetsDir, path).split(sep).join("/")),
    );
    const stale = (await client.list(`${remoteDir}/assets`)).filter(
      (item) => !item.isDirectory && !keep.has(item.name),
    );
    for (const item of stale) {
      await client.remove(`${remoteDir}/assets/${item.name}`);
      console.log(`  pruned ${remoteDir}/assets/${item.name}`);
    }
    console.log(stale.length ? `Pruned ${stale.length} stale file(s).` : "Nothing stale to prune.");
  }
} catch (error) {
  console.error(`FTP deploy failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  client.close();
}

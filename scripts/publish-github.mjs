import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OWNER = process.env.GITHUB_OWNER || "Hiro-Bee";
const REPO = process.env.GITHUB_REPO || "News_Topics_Const-Material";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

if (!TOKEN) {
  console.error("GITHUB_TOKEN or GH_TOKEN is required.");
  process.exit(1);
}

async function github(pathname, options = {}) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${TOKEN}`,
      "User-Agent": "kirii-daily-news-publisher",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method || "GET"} ${pathname} failed: ${response.status} ${body}`);
  }
  return response.json();
}

async function exists(file) {
  try {
    await fs.access(path.join(ROOT, file));
    return true;
  } catch {
    return false;
  }
}

async function listFiles() {
  const rootEntries = await fs.readdir(ROOT);
  const dataEntries = await fs.readdir(path.join(ROOT, "data"));
  const files = [
    "index.html",
    "data/latest.json",
    "scripts/generate-daily.mjs",
    ".github/workflows/daily-news.yml",
    ...rootEntries.filter((file) => /^daily_\d{4}-\d{2}-\d{2}\.html$/.test(file)),
    ...dataEntries
      .filter((file) => /^daily_\d{4}-\d{2}-\d{2}\.json$/.test(file))
      .map((file) => `data/${file}`)
  ];
  const unique = [...new Set(files)].sort();
  return unique.filter((file) => exists(file));
}

async function createBlob(file) {
  const content = await fs.readFile(path.join(ROOT, file), "utf8");
  const blob = await github(`/repos/${OWNER}/${REPO}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content, encoding: "utf-8" })
  });
  return {
    path: file,
    mode: "100644",
    type: "blob",
    sha: blob.sha
  };
}

async function main() {
  const ref = await github(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  const baseCommitSha = ref.object.sha;
  const baseCommit = await github(`/repos/${OWNER}/${REPO}/git/commits/${baseCommitSha}`);
  const files = await listFiles();
  console.warn(`Publishing ${files.length} files to ${OWNER}/${REPO}@${BRANCH}`);

  const treeItems = [];
  for (const file of files) {
    treeItems.push(await createBlob(file));
  }

  const tree = await github(`/repos/${OWNER}/${REPO}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: treeItems
    })
  });

  const commit = await github(`/repos/${OWNER}/${REPO}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: `Update daily news backnumbers through ${new Date().toISOString().slice(0, 10)}`,
      tree: tree.sha,
      parents: [baseCommitSha]
    })
  });

  await github(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha })
  });

  console.log(`Published ${files.length} files: ${commit.html_url}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

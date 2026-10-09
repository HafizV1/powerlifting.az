// Cloud maintainer tooling: creates an external review artifact, never pushes or deploys.
import { readFile, readdir, writeFile, mkdtemp, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { prepareRelease } from "../src/release.mjs";
import { KINDS } from "../src/validation.mjs";
const root = new URL("../../", import.meta.url),
  data = process.argv[2];
if (!data)
  throw Error(
    "Provide a staging state JSON file; this command never changes a branch.",
  );
const state = JSON.parse(await readFile(data, "utf8"));
if (!state.collections || !state.sourceRevision || !state.contentRevision)
  throw Error(
    "state requires collections, sourceRevision and contentRevision Git SHAs",
  );
const show = (filename) =>
  execFileSync("git", ["show", state.sourceRevision + ":" + filename], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
const pages = {};
for (const name of (await readdir(root)).filter((x) => x.endsWith(".html")))
  pages[name] = show(name);
const previous = {};
for (const kind of KINDS) previous[kind] = show("content/v2/" + kind + ".json");
for (const kind of KINDS) previous[kind] = JSON.parse(previous[kind]);
const assets = {};
for (const p of state.collections.protocols.filter(
  (p) => p.importReview?.approved,
)) {
  const name = p.file?.path;
  if (
    !/^assets\/uploads\/protocols\/[a-z0-9-]+\/[a-z0-9-]+\.(pdf|xlsx|docx)$/.test(
      name || "",
    )
  )
    throw Error("Unsafe protocol path");
  assets[name] = execFileSync(
    "git",
    ["show", state.contentRevision + ":" + name],
    { cwd: root, maxBuffer: 11 * 1024 * 1024 },
  );
}
const release = await prepareRelease({
  pages,
  previous,
  collections: state.collections,
  sourceRevision: state.sourceRevision,
  contentRevision: state.contentRevision,
  sourceAssets: assets,
});
const destination = await mkdtemp("/tmp/powerlifting-release-");
await mkdir(destination + "/candidate");
await mkdir(destination + "/backup");
for (const [name, html] of Object.entries(release.output)) {
  await writeFile(destination + "/candidate/" + name, html);
  if (pages[name])
    await writeFile(destination + "/backup/" + name, pages[name]);
}
await writeFile(
  destination + "/manifest.json",
  JSON.stringify(release.manifest, null, 2) + "\n",
);
await writeFile(
  destination + "/approval.example.json",
  JSON.stringify(
    {
      approved: false,
      bundleHash: release.manifest.bundleHash,
      sourceRevision: state.sourceRevision,
      reviewer: "",
      pullRequest: "",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    directory: destination,
    changedPages: release.manifest.files.length,
    publishing: false,
  }),
);

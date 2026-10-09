import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { zipSync, strToU8 } from "fflate";
import { extractTables, pdfRows } from "../src/import/extract.mjs";
import {
  rowsFromTables,
  draftImport,
  athleteMatches,
  approvedRows,
  applyImport,
} from "../src/import/review.mjs";
import { readBaseline, digest } from "../src/import/baseline.mjs";
import { prepareRelease, verifyReleaseApproval } from "../src/release.mjs";
import {
  spreadsheet,
  word,
  textPdf,
  HEADER,
  ROW,
} from "./fixtures/protocols.mjs";
import { KINDS } from "../src/validation.mjs";
const pages = {};
for (const name of (await readdir(new URL("../../", import.meta.url))).filter(
  (n) => n.endsWith(".html"),
))
  pages[name] = await readFile(
    new URL("../../" + name, import.meta.url),
    "utf8",
  );
const baseline = readBaseline(pages),
  previous = {};
for (const k of KINDS)
  previous[k] = JSON.parse(
    await readFile(
      new URL("../../content/v2/" + k + ".json", import.meta.url),
      "utf8",
    ),
  );
const SHA = "a".repeat(40),
  CONTENT = "b".repeat(40),
  context = {
    competitionId: "competitions-staging-test",
    competition: "STAGING TEST — NOT OFFICIAL",
    year: 2099,
    date: "2099-01-01",
    sport: "Pauerliftinq",
  };
const rows = rowsFromTables(
  (await extractTables(spreadsheet(), "test.xlsx")).tables,
).rows;
const decisions = (d) =>
  d.rows.map((r) => ({
    action: "new",
    note: "Synthetic staging fixture checked",
    acknowledge: true,
    corrections: r.result,
  }));
test("real XLSX and DOCX archives extract equivalent result tables with reordered and prefixed rows", async () => {
  const a = await extractTables(spreadsheet(), "test.xlsx"),
    b = await extractTables(word(), "test.docx");
  assert.deepEqual(rowsFromTables(a.tables).rows[0].name, ROW[0]);
  assert.equal(rowsFromTables(b.tables).rows[0].total, "300");
  const order = [4, 0, 8, 3, 2, 6, 1, 7, 5];
  const reordered = [
    ["STAGING TEST"],
    order.map((i) => HEADER[i]),
    order.map((i) => ROW[i]),
  ];
  assert.equal(
    rowsFromTables(
      (await extractTables(spreadsheet(reordered), "test.xlsx")).tables,
    ).rows[0].name,
    ROW[0],
  );
});
test("explicit mapping supports nonstandard headers and unknown tables block silent partial import", async () => {
  const t = [
    {
      name: "custom",
      rows: [
        ["x", "y", "z"],
        ["1", "STAGING TEST", "75"],
      ],
    },
  ];
  assert.deepEqual(rowsFromTables(t).unmapped, ["custom"]);
  assert.equal(
    rowsFromTables(t, {
      table: 0,
      header: 0,
      mapping: { place: 0, name: 1, bestBp: 2 },
    }).rows[0].bestBp,
    "75",
  );
  assert.throws(() =>
    rowsFromTables(t, {
      table: 0,
      header: 0,
      mapping: { __proto__: 5, evil: 1 },
    }),
  );
});
test("actual text PDF extraction preserves cell coordinates; scanned PDF stops instead of guessing", async () => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const reader = async (bytes) => {
    const doc = await getDocument({
      data: bytes,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
    try {
      return [
        {
          name: "PDF 1",
          rows: pdfRows((await (await doc.getPage(1)).getTextContent()).items),
        },
      ];
    } finally {
      await doc.destroy();
    }
  };
  const parsed = await extractTables(textPdf(), "test.pdf", reader);
  const found = rowsFromTables(parsed.tables);
  assert.equal(found.rows[0].name, "STAGING TEST PDF");
  assert.equal(found.rows[0].bestBp, "75");
  await assert.rejects(
    () => extractTables(textPdf([]), "scan.pdf", reader),
    /OCR/,
  );
});
test("malformed files, oversized expansion and XML external entity input are rejected", async () => {
  await assert.rejects(() =>
    extractTables(new Uint8Array(10 * 1024 * 1024 + 1), "big.xlsx"),
  );
  await assert.rejects(() =>
    extractTables(new Uint8Array([80, 75, 3, 4]), "broken.docx"),
  );
  const evil = zipSync({
    "word/document.xml": strToU8(
      '<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><document/>',
    ),
  });
  await assert.rejects(() => extractTables(evil, "evil.docx"), /DTD/);
  const big = zipSync({
    "word/document.xml": new Uint8Array(33 * 1024 * 1024),
  });
  await assert.rejects(() => extractTables(big, "bomb.docx"), /böyük/);
});
test("matching handles name order, ambiguous homonyms, birth conflicts and fuzzy names without automatic duplicates", () => {
  const a = baseline.athletes[0];
  assert.equal(
    athleteMatches(
      { name: a.name.split(" ").reverse().join(" "), gender: a.gender },
      baseline.athletes,
    ).type,
    "exact",
  );
  assert.equal(athleteMatches({ name: a.name }, [a, a]).type, "uncertain");
  assert.equal(
    athleteMatches({ name: a.name, birth: "01.01.2099" }, baseline.athletes)
      .type,
    "uncertain",
  );
  const d = draftImport(
    [{ ...rows[0], name: a.name }],
    context,
    baseline.athletes,
  );
  assert.throws(
    () => approvedRows(d, decisions(d), baseline.athletes),
    /dublikat/,
  );
});
test("validation flags missing fields, totals, sport mixing, rankings, duplicate rows and possible records", () => {
  const d = draftImport(
    [{ ...rows[0], total: "999" }, rows[0], rows[0]],
    context,
    baseline.athletes,
    [
      {
        id: "test",
        sport: context.sport,
        gender: "Kişilər",
        wc: "83 kq",
        move: "Total",
        standard: 200,
        record: 250,
      },
    ],
  );
  assert.ok(d.rows[0].warnings.includes("invalid:total"));
  assert.ok(d.rows[1].warnings.includes("check:possible-record"));
  assert.ok(d.rows[2].warnings.includes("duplicate:row"));
  assert.throws(() => approvedRows(d, decisions(d), baseline.athletes));
  const bench = draftImport(
    rows,
    { ...context, sport: "Benç-press" },
    baseline.athletes,
  );
  assert.ok(bench.rows[0].warnings.includes("invalid:sport"));
  const missing = draftImport(
    [{ name: "STAGING TEST" }],
    context,
    baseline.athletes,
  );
  assert.throws(
    () => approvedRows(missing, decisions(missing), baseline.athletes),
    /düzəldin/,
  );
});
test("approval required for every row; new profiles need explicit action; historical imports are append-only", () => {
  const draft = draftImport(rows, context, baseline.athletes);
  assert.throws(() => approvedRows(draft, [], baseline.athletes));
  const approved = approvedRows(draft, decisions(draft), baseline.athletes),
    next = applyImport(baseline, draft, approved);
  assert.equal(next.athletes.length, 209);
  assert.equal(next.results.length, 352);
  assert.deepEqual(next.athletes.slice(0, 208), baseline.athletes);
  assert.deepEqual(next.results.slice(0, 351), baseline.results);
  assert.throws(() => applyImport(next, draft, approved), /artıq/);
});
test("existing athlete history gains separate Bench Press result without replacing prior results", () => {
  const athlete = baseline.athletes[0],
    raw = {
      name: athlete.name,
      gender: athlete.gender,
      age: "Böyüklər",
      weightclass: "120",
      place: "1",
      bestBp: "100",
    };
  const d = draftImport(
      [raw],
      { ...context, sport: "Benç-press" },
      baseline.athletes,
    ),
    a = approvedRows(
      d,
      [
        {
          action: "existing",
          athleteIndex: 0,
          note: "staging fixture",
          acknowledge: true,
        },
      ],
      baseline.athletes,
    ),
    next = applyImport(baseline, d, a);
  assert.equal(next.athletes.length, 208);
  assert.deepEqual(
    next.athletes[0].results.slice(0, athlete.results.length),
    athlete.results,
  );
  assert.equal(next.athletes[0].results.at(-1)["İdman növü"], "Benç-press");
});
test("unchanged release produces no page changes, including all historical details and homepage", async () => {
  const r = await prepareRelease({
    pages,
    previous,
    collections: structuredClone(previous),
    sourceRevision: SHA,
    contentRevision: CONTENT,
  });
  assert.deepEqual(r.output, {});
  assert.equal(r.manifest.athletesBefore, 208);
  assert.equal(r.manifest.resultsBefore, 351);
});
async function fixtureRelease() {
  const collections = structuredClone(previous),
    draft = draftImport(rows, context, baseline.athletes),
    approved = approvedRows(draft, decisions(draft), baseline.athletes),
    bytes = spreadsheet(),
    sourceHash = await digest(bytes),
    hash = await digest(JSON.stringify({ sourceHash, baseline: SHA, draft }));
  collections.competitions.push({
    id: context.competitionId,
    name: context.competition,
    startDate: "2099-01-01",
    endDate: "2099-01-01",
    sports: [context.sport],
    status: "published",
    venue: "STAGING TEST",
    description: "Synthetic test only",
  });
  const path = "assets/uploads/protocols/protocols-test/file-test.xlsx";
  collections.protocols.push({
    id: "protocols-test",
    title: "STAGING TEST protocol",
    competitionId: context.competitionId,
    sport: context.sport,
    status: "published",
    file: { path },
    importReview: {
      draft,
      sourceHash,
      baseline: SHA,
      hash,
      approved: {
        rows: approved,
        actor: { id: "test", login: "test" },
        reviewHash: hash,
        sourceHash,
      },
    },
  });
  return {
    pages,
    previous,
    collections,
    sourceRevision: SHA,
    contentRevision: CONTENT,
    sourceAssets: { [path]: bytes },
  };
}
test("reviewed release changes DATA and ATH only, preserves styling and all history, and binds source bytes", async () => {
  const args = await fixtureRelease(),
    r = await prepareRelease(args),
    after = readBaseline({ ...pages, ...r.output });
  assert.equal(after.athletes.length, 209);
  assert.equal(after.results.length, 352);
  assert.deepEqual(after.athletes.slice(0, 208), baseline.athletes);
  assert.deepEqual(after.results.slice(0, 351), baseline.results);
  assert.equal(r.output["index.html"], undefined);
  assert.equal(r.output["kubok-2025-haqqinda.html"], undefined);
  assert.equal(
    r.output["idmancilar.html"].replace(
      /const ATH=\[[\s\S]*?\];const esc/,
      "DATA",
    ),
    pages["idmancilar.html"].replace(
      /const ATH=\[[\s\S]*?\];const esc/,
      "DATA",
    ),
  );
  args.sourceAssets[Object.keys(args.sourceAssets)[0]] = new Uint8Array([1]);
  await assert.rejects(() => prepareRelease(args), /faylı dəyişib/);
});
test("unapproved imports cannot change athlete data; approval SHA mismatch and tampering block release", async () => {
  const args = await fixtureRelease();
  args.collections.protocols[0].importReview.approved = null;
  const r = await prepareRelease(args);
  assert.equal(r.output["idmancilar.html"], undefined);
  const a = await fixtureRelease();
  a.collections.protocols[0].importReview.draft.rows[0].result.total = 999;
  await assert.rejects(() => prepareRelease(a), /məzmunu dəyişib/);
});
test("selective news updates preserve untouched historical pages and marker insertion is idempotent", async () => {
  const c = structuredClone(previous);
  c.news.push({
    id: "news-test",
    title: "STAGING TEST",
    body: "<script>test</script>",
    status: "published",
  });
  const r = await prepareRelease({
    pages,
    previous,
    collections: c,
    sourceRevision: SHA,
    contentRevision: CONTENT,
  });
  assert.deepEqual(Object.keys(r.output), ["xeberler.html"]);
  assert.ok(
    r.output["xeberler.html"].includes(
      pages["xeberler.html"].match(
        /<article class="news-card">[\s\S]*?<\/article>/,
      )[0],
    ),
  );
  assert.ok(r.output["xeberler.html"].includes("&lt;script&gt;"));
});
test("release gate binds approval to bundle and current source SHA; no publishing action exists", async () => {
  const r = await prepareRelease(await fixtureRelease());
  await assert.rejects(() =>
    verifyReleaseApproval(r.manifest, { approved: true }, SHA),
  );
  await assert.rejects(() =>
    verifyReleaseApproval(
      r.manifest,
      {
        approved: true,
        bundleHash: r.manifest.bundleHash,
        sourceRevision: SHA,
        reviewer: "test",
        pullRequest: "review",
      },
      CONTENT,
    ),
  );
  assert.equal(
    await verifyReleaseApproval(
      r.manifest,
      {
        approved: true,
        bundleHash: r.manifest.bundleHash,
        sourceRevision: SHA,
        reviewer: "test",
        pullRequest: "review",
      },
      SHA,
    ),
    true,
  );
});
test("real GitHub adapter creates staging-only draft release PR with backups and immutable source refs", async () => {
  const { mock } = await import("./mock-github.mjs"),
    h = await mock(false, true);
  h.commits.set(SHA, h.commits.get("seed"));
  h.refs.set("v2/staging-base", SHA);
  h.refs.set("v2/content-staging", CONTENT);
  h.commits.set(CONTENT, h.commits.get("seed"));
  const state = await h.store.load();
  state.collections.news.push({
    id: "news-staging",
    title: "STAGING ONLY",
    body: "Synthetic fixture, not official news",
    status: "published",
  });
  const r = await h.store.releaseReview(state, { login: "controlled-test" });
  assert.match(r.branch, /^v2\/release-review-/);
  assert.equal(r.publicPublishing, false);
  assert.equal(h.prs[0].draft, true);
  assert.equal(h.prs[0].base, "v2/staging-base");
  assert.equal(h.prs[0].auto_merge, null);
  assert.equal(h.refs.get("main"), "production");
  assert.equal(h.refs.get("v2/staging-base"), SHA);
  assert.equal(h.refs.get("v2/content-staging"), CONTENT);
  const paths = h.writes
    .find((w) => w.route === "git/trees")
    .input.tree.map((x) => x.path);
  assert.ok(paths.some((p) => p.endsWith("/backup/xeberler.html")));
  assert.ok(paths.some((p) => p.endsWith("/manifest.json")));
  assert.ok(!paths.includes("CNAME"));
});
test("production repository cannot prepare a release candidate using staging credentials", async () => {
  const { mock } = await import("./mock-github.mjs"),
    h = await mock();
  await assert.rejects(
    () => h.store.releaseReview({}, {}),
    (e) => e.status === 403,
  );
  assert.equal(h.writes.length, 0);
});
test("rollback restores exact backups, removes only new candidate pages and rejects drift or damaged backup", async () => {
  const { prepareRollback } = await import("../src/release.mjs"),
    release = await prepareRelease(await fixtureRelease()),
    current = { ...pages, ...release.output };
  const rollback = await prepareRollback({
    current,
    backup: pages,
    manifest: release.manifest,
  });
  for (const [name, value] of Object.entries(rollback.restore))
    assert.equal(value, pages[name]);
  assert.ok(rollback.remove.includes("yaris-competitions-staging-test.html"));
  assert.equal(rollback.publishing, false);
  await assert.rejects(
    () =>
      prepareRollback({
        current: { ...current, "neticeler.html": "changed later" },
        backup: pages,
        manifest: release.manifest,
      }),
    /Cari/,
  );
  await assert.rejects(
    () =>
      prepareRollback({
        current,
        backup: { ...pages, "neticeler.html": "broken" },
        manifest: release.manifest,
      }),
    /Backup/,
  );
});
test("competition updates preserve all historical markup and add an explicit escaped update section", async () => {
  const c = structuredClone(previous);
  c.competitions[0].venue = "STAGING changed venue";
  c.competitions[0].description = "<img src=x onerror=bad>";
  const r = await prepareRelease({
    pages,
    previous,
    collections: c,
    sourceRevision: SHA,
    contentRevision: CONTENT,
  });
  const path = c.competitions[0].sourceUrl;
  assert.equal(
    r.output[path].replace(
      /<!-- V2:competition-updates:start -->[\s\S]*?<!-- V2:competition-updates:end -->/,
      "",
    ),
    pages[path],
  );
  assert.ok(r.output[path].includes("&lt;img"));
});
test("album/document/record adapters preserve categories, link gallery and avoid duplicate managed sections", async () => {
  const c = structuredClone(previous),
    cid = c.competitions[0].id;
  c.albums.push({
    id: "albums-test",
    title: "STAGING album",
    competitionId: cid,
    description: "test",
    status: "published",
    photos: [
      {
        id: "test",
        path: "assets/uploads/albums/albums-test/photo.png",
        caption: "test",
        alt: "test",
      },
    ],
  });
  c.recordDocuments.push({
    id: "recorddocuments-test",
    title: "STAGING doc",
    status: "published",
    file: {
      path: "assets/uploads/recordDocuments/recorddocuments-test/test.pdf",
    },
  });
  c.records[0].status = "Müvəqqəti Rekord";
  const r = await prepareRelease({
    pages,
    previous,
    collections: c,
    sourceRevision: SHA,
    contentRevision: CONTENT,
  });
  assert.ok(r.output["qalereya.html"].includes("STAGING album"));
  assert.ok(r.output[c.competitions[0].sourceUrl].includes("qalereya.html"));
  assert.ok(r.output["rekord-qaydalari.html"].includes("STAGING doc"));
  assert.ok(r.output["rekordlar.html"].includes("Müvəqqəti Rekord"));
  c.recordDocuments[0].title = "STAGING doc edited";
  const second = await prepareRelease({
    pages: { ...pages, ...r.output },
    previous,
    collections: c,
    sourceRevision: SHA,
    contentRevision: CONTENT,
  });
  assert.equal(
    second.output["rekord-qaydalari.html"].match(/V2:record-documents:start/g)
      .length,
    1,
  );
  c.records.pop();
  await assert.rejects(
    () =>
      prepareRelease({
        pages,
        previous,
        collections: c,
        sourceRevision: SHA,
        contentRevision: CONTENT,
      }),
    /kateqoriyası/,
  );
});

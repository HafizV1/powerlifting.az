import { renderV1 } from "./render-v1.mjs";
import { readBaseline, renderResults, digest } from "./import/baseline.mjs";
import { applyImport, approvedRows } from "./import/review.mjs";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const section = (name, html) =>
  `<!-- V2:${name}:start -->${html}<!-- V2:${name}:end -->`;
function insert(html, name, value) {
  const marker = new RegExp(
    `<!-- V2:${name}:start -->[\\s\\S]*?<!-- V2:${name}:end -->`,
  );
  const block = value ? section(name, value) : "";
  return marker.test(html)
    ? html.replace(marker, () => block)
    : html.replace("</main>", () => block + "</main>");
}
function cards(page, klass) {
  return (
    page.match(
      new RegExp(`<article class="${klass}">[\\s\\S]*?<\\/article>`, "g"),
    ) || []
  );
}
function reconcileCards(
  original,
  generated,
  klass,
  previous,
  next,
  titleKey,
  container,
) {
  let html = original;
  const available = cards(generated, klass);
  const escape = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const find = (arr, item) =>
    arr.find((c) => c.includes(">" + escape(item[titleKey]) + "</h"));
  for (const old of previous) {
    const item = next.find((x) => x.id === old.id);
    if (equal(old, item)) continue;
    const card = find(cards(html, klass), old);
    if (old.status === "published" && !card)
      throw Error(
        "Tarixi kart tapılmadı; əl ilə adapter yoxlaması tələb olunur.",
      );
    const replacement =
      item?.status === "published" ? find(available, item) || "" : "";
    if (card) html = html.replace(card, () => replacement);
    else if (replacement)
      html = html.replace(container, (m) => m + replacement);
  }
  for (const item of next.filter(
    (x) => !previous.some((p) => p.id === x.id) && x.status === "published",
  )) {
    const card = find(available, item);
    if (!card) throw Error("Yeni məzmun kartı tapılmadı.");
    html = html.replace(container, (m) => m + card);
  }
  return html;
}
export async function prepareRelease({
  pages,
  previous,
  collections,
  sourceRevision,
  contentRevision,
  sourceAssets = {},
}) {
  if (
    !/^[a-f0-9]{40}$/.test(sourceRevision) ||
    !/^[a-f0-9]{40}$/.test(contentRevision)
  )
    throw Error("Mənbə və məzmun Git revision tələb olunur.");
  const original = readBaseline(pages);
  if (original.athletes.length < 208) throw Error("208 idmançı qorunmalıdır.");
  const output = {};
  const changedKinds = Object.keys(previous).filter(
    (k) => !equal(previous[k], collections[k]),
  );
  const generated = changedKinds.length ? renderV1(pages, collections) : {};
  if (changedKinds.includes("news"))
    output["xeberler.html"] = reconcileCards(
      pages["xeberler.html"],
      generated["xeberler.html"],
      "news-card",
      previous.news,
      collections.news,
      "title",
      '<div class="wrap">',
    );
  if (changedKinds.includes("competitions")) {
    output["yarislar.html"] = reconcileCards(
      pages["yarislar.html"],
      generated["yarislar.html"],
      "race-card",
      previous.competitions,
      collections.competitions,
      "name",
      '<div class="race-list">',
    );
    for (const c of collections.competitions.filter(
      (x) =>
        x.status === "published" &&
        !previous.competitions.some((p) => p.id === x.id),
    )) {
      const filename = "yaris-" + c.id + ".html";
      if (!/^yaris-competitions-[a-z0-9-]+\.html$/.test(filename))
        throw Error("Yarış ünvanı etibarsızdır.");
      output[filename] = generated[filename];
    }
    for (const c of previous.competitions) {
      const next = collections.competitions.find((x) => x.id === c.id);
      if (!next || equal(c, next) || next.status !== "published") continue;
      const filename = c.sourceUrl;
      if (!filename || !pages[filename])
        throw Error("Tarixi yarış səhifəsi tapılmadı.");
      const html = `<section class="wrap"><h2>Yenilənmiş yarış məlumatları</h2><h3>${esc(next.name)}</h3><p><strong>Tarix:</strong> ${esc(next.dateText || next.startDate + " – " + next.endDate)}</p><p><strong>Məkan:</strong> ${esc(next.venue)}</p><p>${next.sports.map(esc).join(" · ")}</p>${next.description ? "<p>" + esc(next.description).replaceAll("\n", "<br>") + "</p>" : ""}</section>`;
      output[filename] = insert(pages[filename], "competition-updates", html);
    }
  }
  if (
    collections.records.length < previous.records.length ||
    previous.records.some(
      (old) =>
        !collections.records.some(
          (r) =>
            r.id === old.id &&
            ["sport", "gender", "wc", "move"].every((k) => r[k] === old[k]),
        ),
    )
  )
    throw Error("Tarixi rekord kateqoriyası silinə və ya dəyişdirilə bilməz.");
  if (changedKinds.includes("records"))
    output["rekordlar.html"] = generated["rekordlar.html"];
  for (const [kind, page, name] of [
    ["protocols", "neticeler.html", "protocols"],
    ["recordDocuments", "rekord-qaydalari.html", "record-documents"],
  ])
    if (changedKinds.includes(kind)) {
      const items = collections[kind].filter((x) => x.status === "published");
      const esc = (v) =>
        String(v).replace(
          /[&<>"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[c],
        );
      const links = items
        .map((x) => {
          if (
            !x.file ||
            !/^assets\/uploads\/[a-zA-Z0-9/_.-]+$/.test(x.file.path) ||
            x.file.path.includes("..")
          )
            throw Error("Sənəd mənbəyi etibarsızdır.");
          return `<p><a href="${esc(x.file.path)}" download>${esc(x.title)}</a>${x.sport ? " — " + esc(x.sport) : ""}${x.description ? " — " + esc(x.description) : ""}</p>`;
        })
        .join("");
      output[page] = insert(
        pages[page],
        name,
        links
          ? `<section class="wrap"><h2>${kind === "protocols" ? "Nəticələr və protokollar" : "Rekord sənədləri"}</h2>${links}</section>`
          : "",
      );
    }
  if (
    changedKinds.includes("albums") &&
    (collections.albums.some((x) => x.status === "published") ||
      pages["qalereya.html"])
  ) {
    output["qalereya.html"] = generated["qalereya.html"];
    const links = collections.albums
      .filter((x) => x.status === "published")
      .map((a) => a.competitionId);
    for (const cid of new Set(links)) {
      const c = collections.competitions.find((x) => x.id === cid);
      const filename = c?.sourceUrl || "yaris-" + cid + ".html";
      if (!c || !(pages[filename] || output[filename])) continue;
      const page = (output[filename] || pages[filename]).replace(
        /<!-- V2:album-link:start -->[\s\S]*?<!-- V2:album-link:end -->/, "",
      );
      if (!page.includes('</div></main>'))
        throw Error('Yarış səhifəsinin məzmun konteyneri tapılmadı.');
      output[filename] = page.replace('</div></main>',
        section('album-link', '<p><a href="qalereya.html">Fotoqalereya →</a></p>') + '</div></main>');
    }
  }
  if (changedKinds.includes("protocols"))
    for (const c of collections.competitions) {
      const filename = c.sourceUrl || "yaris-" + c.id + ".html";
      if (!(pages[filename] || output[filename])) continue;
      const protocols = collections.protocols.filter(
        (p) => p.competitionId === c.id && p.status === "published",
      );
      const links = protocols
        .map(
          (p) =>
            `<p><a href="${esc(p.file?.path)}" download>${esc(p.title)}</a> — ${esc(p.sport)}</p>`,
        )
        .join("");
      output[filename] = insert(
        output[filename] || pages[filename],
        "competition-protocols",
        links
          ? `<section class="wrap"><h2>Nəticələr və protokollar</h2>${links}</section>`
          : "",
      );
    }
  let data = original;
  const imports = [];
  for (const p of collections.protocols.filter(
    (x) => x.status === "published" && x.importReview?.approved,
  )) {
    const old = previous.protocols.find((x) => x.id === p.id);
    if (equal(old?.importReview?.approved, p.importReview.approved)) continue;
    const review = p.importReview,
      approval = review.approved,
      context = review.draft.context,
      c = collections.competitions.find((x) => x.id === p.competitionId);
    if (
      !c ||
      context.competitionId !== c.id ||
      context.competition !== c.name ||
      context.sport !== p.sport ||
      context.year !== Number(c.startDate.slice(0, 4)) ||
      context.date !== (c.dateText || c.startDate) ||
      review.baseline !== sourceRevision ||
      approval.reviewHash !== review.hash ||
      !approval.actor?.id
    )
      throw Error(
        "İdxal təsdiqi və başlanğıc mənbə uyğun deyil. Yenidən yoxlayın.",
      );
    const bytes = sourceAssets[p.file?.path];
    if (
      !bytes ||
      (await digest(bytes)) !== review.sourceHash ||
      approval.sourceHash !== review.sourceHash
    )
      throw Error("Təsdiqlənmiş protokol faylı dəyişib.");
    const hash = await digest(
      JSON.stringify({
        sourceHash: review.sourceHash,
        baseline: review.baseline,
        draft: review.draft,
      }),
    );
    if (hash !== review.hash) throw Error("İdxal yoxlama məzmunu dəyişib.");
    // Revalidate the approved payload, not merely the status label.
    const decisions = review.draft.rows.map((row) => {
      const a = approval.rows.find((a) => a.sourceIndex === row.index);
      return a
        ? {
            action: a.newAthlete ? "new" : "existing",
            athleteIndex: a.athleteIndex,
            corrections: a.result,
            acknowledge: true,
            note: a.note,
          }
        : { action: "skip" };
    });
    const checked = approvedRows(review.draft, decisions, original.athletes);
    if (!equal(checked, approval.rows))
      throw Error("Təsdiqlənmiş nəticə məlumatı uyğun deyil.");
    data = applyImport(data, review.draft, approval.rows);
    imports.push({
      protocol: p.id,
      sport: p.sport,
      count: approval.rows.length,
      sourceHash: review.sourceHash,
      actor: approval.actor,
    });
  }
  if (imports.length) {
    Object.assign(
      output,
      renderResults(
        {
          ...pages,
          "neticeler.html": output["neticeler.html"] || pages["neticeler.html"],
        },
        data,
      ),
    );
  }
  for (const [name, value] of Object.entries(output))
    if (value === pages[name]) delete output[name];
  const allowed =
    /^(xeberler|yarislar|rekordlar|neticeler|rekord-qaydalari|qalereya|idmancilar|kubok-202[56]-haqqinda|cempionat-2026-haqqinda|yaris-competitions-[a-z0-9-]+)\.html$/;
  for (const name of Object.keys(output))
    if (!allowed.test(name) || typeof output[name] !== "string")
      throw Error("İxrac yolu qadağandır.");
  // Existing result history is append-only. No imported record is ratified automatically.
  if (
    !equal(data.results.slice(0, original.results.length), original.results) ||
    data.athletes.slice(0, original.athletes.length).some((a, i) => {
      const b = original.athletes[i];
      return (
        a.name !== b.name ||
        a.gender !== b.gender ||
        a.city !== b.city ||
        !equal(a.results.slice(0, b.results.length), b.results)
      );
    })
  )
    throw Error("Tarixi məlumat dəyişib.");
  const files = await Promise.all(
    Object.entries(output)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(async ([name, value]) => ({
        path: name,
        before: pages[name] ? await digest(pages[name]) : null,
        after: await digest(value),
      })),
  );
  const manifest = {
    version: 1,
    sourceRevision,
    contentRevision,
    changedKinds,
    files,
    imports,
    athletesBefore: original.athletes.length,
    athletesAfter: data.athletes.length,
    resultsBefore: original.results.length,
    resultsAfter: data.results.length,
    publicPublishing: false,
  };
  return {
    output,
    manifest: {
      ...manifest,
      bundleHash: await digest(JSON.stringify(manifest)),
    },
  };
}
export async function verifyReleaseApproval(
  manifest,
  approval,
  currentRevision,
) {
  const { bundleHash, ...bound } = manifest;
  if ((await digest(JSON.stringify(bound))) !== bundleHash)
    throw Error("Yayım manifest dəyişib.");
  if (
    manifest.publicPublishing !== false ||
    approval?.bundleHash !== manifest.bundleHash ||
    approval?.sourceRevision !== manifest.sourceRevision ||
    currentRevision !== manifest.sourceRevision ||
    approval?.approved !== true ||
    !approval?.reviewer ||
    !approval?.pullRequest
  )
    throw Error(
      "Yayım üçün cari SHA və paket üzrə ayrıca təsdiq tələb olunur.",
    );
  return true;
}
export async function prepareRollback({ current, backup, manifest }) {
  if (
    !manifest ||
    !Array.isArray(manifest.files) ||
    manifest.publicPublishing !== false
  )
    throw Error("Rollback manifest tələb olunur.");
  const { bundleHash, ...bound } = manifest;
  if ((await digest(JSON.stringify(bound))) !== bundleHash)
    throw Error("Rollback manifest dəyişib.");
  const restore = {},
    remove = [];
  for (const file of manifest.files) {
    if ((await digest(current[file.path] || "")) !== file.after)
      throw Error(
        "Cari səhifə dəyişib; rollback digər dəyişiklikləri əvəz edə bilməz.",
      );
    if (file.before) {
      const old = backup[file.path];
      if (typeof old !== "string" || (await digest(old)) !== file.before)
        throw Error("Backup hash uyğun deyil.");
      restore[file.path] = old;
    } else remove.push(file.path);
  }
  return { restore, remove, reviewRequired: true, publishing: false };
}

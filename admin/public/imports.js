import { getDocument, GlobalWorkerOptions } from "/pdf.mjs";
GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
const $ = (id) => document.getElementById(id),
  esc = (v) =>
    String(v ?? "").replace(
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
const params = new URLSearchParams(location.search),
  id = params.get("id"),
  test = params.get("stagingTest");
let session, state, baseline, item, review, pdfTables;
async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  if (test) headers.set("X-Staging-Test-Run", test);
  if (options.method) {
    headers.set("X-CSRF-Token", session.csrf);
    headers.set("If-Match", state.revision);
    headers.set("Content-Type", "application/json");
    options.body = JSON.stringify(options.body);
  }
  const r = await fetch("/api/" + path, { ...options, headers }),
    v = await r.json();
  if (!r.ok) throw Error(v.error || "Sorğu uğursuz oldu.");
  return v;
}
async function busy(fn) {
  $("extract").disabled = true;
  $("approve").disabled = true;
  $("status").textContent = "Yoxlanılır…";
  try {
    await fn();
  } catch (e) {
    $("status").textContent = e.message;
  } finally {
    $("extract").disabled = false;
    $("approve").disabled = false;
  }
}
async function pdf() {
  const url =
    "/api/assets?path=" +
    encodeURIComponent(item.file.path) +
    (test ? "&stagingTest=" + encodeURIComponent(test) : "");
  const r = await fetch(url);
  if (!r.ok) throw Error("PDF yüklənmədi.");
  const data = new Uint8Array(await r.arrayBuffer());
  if (data.length > 10 * 1024 * 1024) throw Error("PDF çox böyükdür.");
  const doc = await getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
    stopAtErrors: true,
  }).promise;
  try {
    if (doc.numPages > 100) throw Error("PDF ən çox 100 səhifə ola bilər.");
    const tables = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p),
        content = await page.getTextContent(),
        lines = [];
      for (const it of content.items.filter((i) => i.str?.trim())) {
        let line = lines.find((l) => Math.abs(l.y - it.transform[5]) < 3);
        if (!line) {
          line = { y: it.transform[5], items: [] };
          lines.push(line);
        }
        line.items.push({ x: it.transform[4], value: it.str });
      }
      tables.push({
        name: "PDF " + p,
        rows: lines
          .sort((a, b) => b.y - a.y)
          .map((l) =>
            l.items.sort((a, b) => a.x - b.x).map((i) => i.value.trim()),
          ),
      });
    }
    return tables;
  } finally {
    await doc.destroy();
  }
}
const fieldLabels = {
  name: "Ad və soyad",
  birth: "Doğum tarixi",
  gender: "Cins",
  age: "Yaş qrupu",
  weightclass: "Çəki dərəcəsi",
  bodyweight: "Bədən çəkisi",
  place: "Yer / sıralama",
  club: "Şəhər / klub",
  bestSq: "Ən yaxşı Squat",
  bestBp: "Ən yaxşı Benç",
  bestDl: "Ən yaxşı Deadlift",
  total: "Toplam",
  gl: "GL / xal",
  equipment: "Ekipirovka",
};
function render() {
  const rows = review.draft.rows;
  $("review").innerHTML = rows
    .map(
      (row) =>
        `<article class="row" data-row="${row.index}" style="display:block"><h3>${esc(row.result.name)} · ${esc(row.result.weightclass)}</h3><p>${esc(row.warnings.join(" · ") || "Avtomatik xəbərdarlıq yoxdur")}</p>${review.pdfClientExtracted ? "<p>PDF mətnini orijinal sənədlə yoxlayın.</p>" : ""}<label>Qərar<select data-action><option value="">Seçin</option><option value="existing">Mövcud idmançı</option><option value="new">Yeni idmançı</option><option value="skip">Sətiri keç</option></select></label><label>Mövcud idmançı<select data-athlete><option value="">Seçin</option>${baseline.athletes.map((a) => `<option value="${a.index}" ${row.match.index === a.index ? "selected" : ""}>${esc(a.name)} — ${esc(a.gender)}</option>`).join("")}</select></label><div class="field-grid">${Object.entries(
          row.result,
        )
          .map(
            ([key, value]) =>
              `<label>${esc(fieldLabels[key] || key)}<input data-field="${esc(key)}" value="${esc(value ?? "")}" maxlength="250"></label>`,
          )
          .join(
            "",
          )}</div><label>Yoxlama qeydi<input data-note maxlength="1000"></label><label><input type="checkbox" data-ack> Mənbə, uyğunluq, sıralama və mümkün rekordları yoxladım</label></article>`,
    )
    .join("");
  $("approve").hidden = false;
  $("status").textContent = review.approved
    ? "Əvvəllər təsdiqlənib. Dəyişiklik üçün yenidən yoxlayın."
    : `${rows.length} nəticə yoxlama gözləyir.`;
}
$("extract").onclick = () =>
  busy(async () => {
    const mapping = $("mapping").value.trim()
      ? JSON.parse($("mapping").value)
      : undefined;
    if (item.file.name.toLowerCase().endsWith(".pdf")) {
      pdfTables = await pdf();
      $("tables").textContent = JSON.stringify(pdfTables, null, 2);
    }
    const v = await api("import/" + id + "/extract", {
      method: "POST",
      body: { mapping, pdfTables },
    });
    state.revision = v.revision;
    review = v.review;
    render();
  });
$("approve").onclick = () =>
  busy(async () => {
    const decisions = [...document.querySelectorAll("[data-row]")].map(
      (node) => ({
        action: node.querySelector("[data-action]").value,
        athleteIndex:
          node.querySelector("[data-athlete]").value === ""
            ? null
            : Number(node.querySelector("[data-athlete]").value),
        corrections: Object.fromEntries(
          [...node.querySelectorAll("[data-field]")].map((input) => [
            input.dataset.field,
            input.value,
          ]),
        ),
        note: node.querySelector("[data-note]").value,
        acknowledge: node.querySelector("[data-ack]").checked,
      }),
    );
    const v = await api("import/" + id + "/approve", {
      method: "POST",
      body: { hash: review.hash, decisions },
    });
    state.revision = v.revision;
    review = v.review;
    $("status").textContent =
      "Nəticələr qaralamada təsdiqləndi. Canlı yayım baş vermədi.";
  });
(async () => {
  try {
    session = await api("session");
    if (!session.user) {
      location.href = "/api/auth/github";
      return;
    }
    state = await api("content");
    baseline = await api("import/baseline");
    item = state.collections.protocols.find((x) => x.id === id);
    if (!item?.file) throw Error("Protokolu yaradın və fayl yükləyin.");
    $("title").textContent = item.title + " — " + item.sport;
    $("controls").hidden = false;
    $("status").textContent = "Analiz üçün hazırdır.";
    review = item.importReview;
    if (review) render();
  } catch (e) {
    $("status").textContent = e.message;
  }
})();

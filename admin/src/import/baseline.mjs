export function readBaseline(pages) {
  const read = (name, pattern) => {
    const m = pages[name]?.match(pattern);
    if (!m) throw Error("V1 məlumat mənbəyi tapılmadı: " + name);
    const value = JSON.parse(m[1]);
    if (!Array.isArray(value)) throw Error("V1 məlumat mənbəyi düzgün deyil.");
    return value;
  };
  return {
    athletes: read("idmancilar.html", /const ATH=(\[[\s\S]*?\]);const esc/),
    results: read("neticeler.html", /const DATA=(\[[\s\S]*?\]);/),
  };
}
const safe = (value) =>
  JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
export function renderResults(pages, data) {
  return {
    "idmancilar.html": pages["idmancilar.html"].replace(
      /const ATH=\[[\s\S]*?\];const esc/,
      () => `const ATH=${safe(data.athletes)};const esc`,
    ),
    "neticeler.html": pages["neticeler.html"].replace(
      /const DATA=\[[\s\S]*?\];/,
      () => `const DATA=${safe(data.results)};`,
    ),
  };
}
export async function digest(value) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}

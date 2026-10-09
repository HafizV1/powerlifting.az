import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
export const LIMITS = {
  bytes: 10 * 1024 * 1024,
  expanded: 32 * 1024 * 1024,
  entries: 1500,
  rows: 5000,
  cells: 100000,
  pages: 100,
};
const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
function xml(bytes) {
  const s = strFromU8(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(s))
    throw Error("XML DTD və xarici istinadlar qəbul edilmir.");
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
  }).parse(s);
}
const text = (v) =>
  v == null
    ? ""
    : typeof v === "object"
      ? list(v.t).map(text).join("") +
        list(v.r).map(text).join("") +
        (v["#text"] || "")
      : String(v);
function archive(bytes) {
  let total = 0,
    count = 0;
  return unzipSync(bytes, {
    filter: (f) => {
      if (
        ++count > LIMITS.entries ||
        !Number.isSafeInteger(f.originalSize) ||
        (total += f.originalSize) > LIMITS.expanded
      )
        throw Error("Arxiv açıldıqda həddindən çox böyükdür.");
      if (
        f.name.includes("..") ||
        f.name.startsWith("/") ||
        f.name.includes("\\")
      )
        throw Error("Arxiv yolu etibarsızdır.");
      return /^(xl\/.*\.xml|word\/document\.xml)$/.test(f.name);
    },
  });
}
function column(ref) {
  const letters = String(ref).match(/^[A-Z]+/)?.[0];
  if (!letters) throw Error("Excel xana ünvanı düzgün deyil.");
  let n = 0;
  for (const c of letters) n = n * 26 + c.charCodeAt(0) - 64;
  if (n > 512) throw Error("Sütun sayı çox böyükdür.");
  return n - 1;
}
function xlsx(bytes) {
  const files = archive(bytes);
  if (!files["xl/workbook.xml"]) throw Error("XLSX iş kitabı tapılmadı.");
  const strings = files["xl/sharedStrings.xml"]
    ? list(xml(files["xl/sharedStrings.xml"]).sst?.si).map(text)
    : [];
  const sheets = [];
  let cells = 0;
  for (const name of Object.keys(files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const tree = xml(files[name]),
      rows = [];
    for (const row of list(tree.worksheet?.sheetData?.row)) {
      if (rows.length >= LIMITS.rows) throw Error("Sətir limiti aşılıb.");
      const values = [];
      for (const c of list(row.c)) {
        if (++cells > LIMITS.cells) throw Error("Xana limiti aşılıb.");
        const i = column(c["@r"]);
        if (c.f != null) {
          values[i] = c.v == null ? "" : text(c.v);
        } else
          values[i] =
            c["@t"] === "s"
              ? strings[Number(c.v)] || ""
              : c["@t"] === "inlineStr"
                ? text(c.is)
                : text(c.v);
      }
      rows.push(
        Array.from({ length: values.length }, (_, i) => values[i] || ""),
      );
    }
    sheets.push({ name, rows });
  }
  if (!sheets.length) throw Error("Excel cədvəli tapılmadı.");
  return sheets;
}
function docx(bytes) {
  const files = archive(bytes);
  if (!files["word/document.xml"]) throw Error("Word sənədi tapılmadı.");
  const doc = xml(files["word/document.xml"]);
  const tables = list(doc.document?.body?.tbl);
  let count = 0;
  const sheets = tables.map((table, i) => ({
    name: "Word cədvəli " + (i + 1),
    rows: list(table.tr).map((tr) => {
      if (++count > LIMITS.rows) throw Error("Sətir limiti aşılıb.");
      return list(tr.tc).map((tc) =>
        list(tc.p)
          .map((p) =>
            list(p.r)
              .map((r) => text(r.t))
              .join(""),
          )
          .join(" ")
          .trim(),
      );
    }),
  }));
  if (!sheets.length)
    throw Error(
      "Word sənədində cədvəl yoxdur. Mətn üçün əl ilə yoxlama tələb olunur.",
    );
  return sheets;
}
export function pdfRows(items) {
  const lines = [];
  for (const item of items.filter((x) => x.str?.trim())) {
    const y = item.transform[5],
      x = item.transform[4];
    let line = lines.find((l) => Math.abs(l.y - y) < 3);
    if (!line) {
      line = { y, items: [] };
      lines.push(line);
    }
    line.items.push({ x, value: item.str });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((l) => l.items.sort((a, b) => a.x - b.x).map((x) => x.value.trim()));
}
export async function extractTables(bytes, name, pdfReader) {
  if (
    !(bytes instanceof Uint8Array) ||
    !bytes.length ||
    bytes.length > LIMITS.bytes
  )
    throw Error("Fayl ən çox 10 MB ola bilər.");
  const ext = name.split(".").pop().toLowerCase();
  let tables;
  if (ext === "xlsx") tables = xlsx(bytes);
  else if (ext === "docx") tables = docx(bytes);
  else if (ext === "pdf") {
    if (!pdfReader) throw Error("PDF mətn analizatoru tələb olunur.");
    tables = await pdfReader(bytes);
    if (!tables.some((t) => t.rows.some((r) => r.some(Boolean))))
      throw Error(
        "PDF mətnsizdir. Skan üçün OCR və əl ilə yoxlama tələb olunur.",
      );
  } else throw Error("İdxal üçün XLSX, DOCX və mətnli PDF dəstəklənir.");
  if (
    tables.reduce((n, t) => n + t.rows.length, 0) > LIMITS.rows ||
    tables.reduce((n, t) => n + t.rows.reduce((n, r) => n + r.length, 0), 0) >
      LIMITS.cells
  )
    throw Error("Cədvəl limiti aşılıb.");
  return { format: ext, tables };
}

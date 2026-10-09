import { zipSync, strToU8 } from "fflate";
export const HEADER = [
  "Name",
  "Gender",
  "Category",
  "Weight Class",
  "Place",
  "Squat",
  "Bench",
  "Deadlift",
  "Total",
];
export const ROW = [
  "STAGING TEST New Athlete",
  "Men",
  "Böyüklər",
  "83",
  "1",
  "100",
  "75",
  "125",
  "300",
];
const esc = (v) =>
  String(v).replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c],
  );
export function spreadsheet(rows = [HEADER, ROW]) {
  const sheet =
    "<worksheet><sheetData>" +
    rows
      .map(
        (row, i) =>
          '<row r="' +
          (i + 1) +
          '">' +
          row
            .map(
              (v, j) =>
                '<c r="' +
                String.fromCharCode(65 + j) +
                (i + 1) +
                '" t="inlineStr"><is><t>' +
                esc(v) +
                "</t></is></c>",
            )
            .join("") +
          "</row>",
      )
      .join("") +
    "</sheetData></worksheet>";
  return zipSync({
    "xl/workbook.xml": strToU8("<workbook/>"),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  });
}
export function word(rows = [HEADER, ROW]) {
  return zipSync({
    "word/document.xml": strToU8(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>' +
        rows
          .map(
            (row) =>
              "<w:tr>" +
              row
                .map(
                  (v) =>
                    "<w:tc><w:p><w:r><w:t>" +
                    esc(v) +
                    "</w:t></w:r></w:p></w:tc>",
                )
                .join("") +
              "</w:tr>",
          )
          .join("") +
        "</w:tbl></w:body></w:document>",
    ),
  });
}
export function textPdf(
  rows = [
    ["Name", "Gender", "Category", "Class", "Place", "Bench"],
    ["STAGING TEST PDF", "Men", "Adults", "83", "1", "75"],
  ],
) {
  const stream = rows
    .flatMap((row, i) =>
      row.map(
        (v, j) =>
          `BT /F1 8 Tf 1 0 0 1 ${25 + j * 92} ${720 - i * 24} Tm (${String(v).replace(/[()\\]/g, "\\$&")}) Tj ET`,
      ),
    )
    .join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 700 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let s = "%PDF-1.4\n",
    offsets = [0];
  for (let i = 0; i < objs.length; i++) {
    offsets.push(s.length);
    s += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = s.length;
  s +=
    "xref\n0 6\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return strToU8(s);
}

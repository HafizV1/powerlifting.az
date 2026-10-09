export const SPORTS = ["Pauerliftinq", "Benç-press"];
export const normalize = (v) =>
  String(v ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("az")
    .replace(/[ıi]/g, "i")
    .replace(/[^\p{L}\p{N}+]+/gu, " ")
    .trim();
const aliases = {
  name: [
    "ad soyad",
    "soyad ad",
    "idmançı",
    "athlete",
    "name",
    "lifter",
    "full name",
  ],
  birth: ["doğum tarixi", "birth", "dob", "date of birth"],
  gender: ["cins", "gender", "sex"],
  age: ["yaş qrupu", "age category", "category", "yaş", "division"],
  weightclass: ["çəki dərəcəsi", "weight class", "class", "wc"],
  bodyweight: ["bədən çəkisi", "bodyweight", "body weight", "bw"],
  place: ["yer", "place", "rank", "ranking"],
  club: ["şəhər klub", "club", "team"],
  bestSq: ["ən yaxşı squat", "best squat", "squat"],
  bestBp: [
    "ən yaxşı bench",
    "best bench",
    "bench press",
    "bench",
    "ən yaxşı benç",
  ],
  bestDl: ["ən yaxşı deadlift", "best deadlift", "deadlift"],
  total: ["toplam", "total", "sum"],
  gl: ["gl", "xal", "points"],
  equipment: ["equipment", "ekipirovka"],
};
export const FIELDS = Object.keys(aliases);
const header = (v) => normalize(v).replace(/ kq$| kg$/, "");
function mapping(row) {
  const result = {};
  for (const [key, names] of Object.entries(aliases)) {
    const i = row.findIndex((cell) =>
      names.some((n) => header(cell) === header(n)),
    );
    if (i >= 0) result[key] = i;
  }
  return result;
}
const num = (v) => {
  const s = String(v ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  return s === "" ? null : /^-?\d+(?:\.\d+)?$/.test(s) ? Number(s) : null;
};
export function rowsFromTables(tables, custom) {
  let rows = [],
    unmapped = [];
  for (const [ti, table] of tables.entries()) {
    let hi = -1,
      map;
    for (let i = 0; i < Math.min(table.rows.length, 30); i++) {
      const m = mapping(table.rows[i]);
      if ("name" in m && Object.keys(m).length >= 3) {
        hi = i;
        map = m;
        break;
      }
    }
    const config = Array.isArray(custom)
      ? custom.find((c) => ti === Number(c.table))
      : custom;
    if (config && ti === Number(config.table)) {
      hi = Number(config.header);
      map = config.mapping;
      if (
        !map ||
        typeof map !== "object" ||
        !("name" in map) ||
        Object.entries(map).some(
          ([k, v]) =>
            !FIELDS.includes(k) || !Number.isInteger(v) || v < 0 || v >= 512,
        )
      )
        throw Error("Sütun uyğunlaşdırması düzgün deyil.");
    }
    if (hi < 0 || !map || !("name" in map)) {
      unmapped.push(table.name);
      continue;
    }
    if (
      !Number.isInteger(hi) ||
      hi < 0 ||
      hi >= table.rows.length ||
      Object.entries(map).some(
        ([k, v]) =>
          !FIELDS.includes(k) || !Number.isInteger(v) || v < 0 || v >= 512,
      )
    )
      throw Error("Sütun uyğunlaşdırması düzgün deyil.");
    for (let i = hi + 1; i < table.rows.length; i++) {
      const cells = table.rows[i];
      if (
        !cells[map.name] ||
        header(cells[map.name]) === header(table.rows[hi][map.name])
      )
        continue;
      const r = {};
      for (const [key, col] of Object.entries(map))
        r[key] = String(cells[col] ?? "").trim();
      r.source = { table: table.name, row: i + 1 };
      rows.push(r);
    }
  }
  return { rows, unmapped };
}
function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] !== b[j - 1]),
      );
    prev = next;
  }
  return prev[b.length];
}
export function athleteMatches(row, athletes) {
  const n = normalize(row.name),
    tokens = n.split(" ").sort().join(" ");
  const compatible = (a) => !row.gender || !a.gender || row.gender === a.gender;
  const exact = athletes
    .map((a, i) => ({ a, i }))
    .filter(
      ({ a }) =>
        normalize(a.name) === n ||
        normalize(a.name).split(" ").sort().join(" ") === tokens,
    );
  const safe = exact.filter(
    ({ a }) =>
      compatible(a) &&
      (!row.birth ||
        !a.results.some(
          (r) => r["Doğum tarixi"] && r["Doğum tarixi"] !== row.birth,
        )),
  );
  if (safe.length === 1)
    return { type: "exact", index: safe[0].i, name: safe[0].a.name };
  const candidates = athletes
    .map((a, index) => ({
      index,
      name: a.name,
      score: distance(n, normalize(a.name)),
    }))
    .filter(
      (c) =>
        c.score <= Math.max(2, Math.floor(n.length * 0.2)) ||
        exact.some((e) => e.i === c.index),
    )
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);
  return { type: candidates.length ? "uncertain" : "new", candidates };
}
export function draftImport(rawRows, context, athletes, records = []) {
  if (
    !context ||
    !SPORTS.includes(context.sport) ||
    !context.competitionId ||
    !context.competition ||
    !Number.isInteger(context.year) ||
    context.year < 1900 ||
    context.year > 2200 ||
    !context.date
  )
    throw Error("Yarış, il, tarix və idman növü tələb olunur.");
  if (!Array.isArray(rawRows) || !rawRows.length || rawRows.length > 5000)
    throw Error("İdxal sətirləri tapılmadı və ya limit aşılıb.");
  const seen = new Set();
  const rows = rawRows.map((input, index) => {
    const r = {};
    for (const key of FIELDS)
      r[key] = String(input[key] ?? "")
        .trim()
        .slice(0, 250);
    const badNumbers = [];
    for (const key of [
      "bodyweight",
      "bestSq",
      "bestBp",
      "bestDl",
      "total",
      "gl",
    ]) {
      const raw = r[key];
      r[key] = num(raw);
      if (raw && r[key] == null) badNumbers.push("invalid:" + key);
    }
    r.gender = /^(male|men|m|kişilər)$/i.test(r.gender)
      ? "Kişilər"
      : /^(female|women|f|qadınlar)$/i.test(r.gender)
        ? "Qadınlar"
        : r.gender;
    r.weightclass = r.weightclass.replace(/\s*(kg|kq)$/i, "").trim();
    if (r.weightclass) r.weightclass += " kq";
    const warnings = [...badNumbers];
    for (const key of ["name", "gender", "age", "weightclass", "place"])
      if (!r[key]) warnings.push("missing:" + key);
    if (!["Kişilər", "Qadınlar"].includes(r.gender))
      warnings.push("invalid:gender");
    if (r.name.length < 3 || /[<>\u0000-\u001f]/.test(r.name))
      warnings.push("invalid:name");
    if (!/^\+?\d+(?:\.\d+)? kq$/.test(r.weightclass))
      warnings.push("invalid:weightclass");
    for (const key of [
      "bodyweight",
      "bestSq",
      "bestBp",
      "bestDl",
      "total",
      "gl",
    ])
      if (
        r[key] != null &&
        (!Number.isFinite(r[key]) || r[key] < 0 || r[key] > 3000)
      )
        warnings.push("invalid:" + key);
    if (!/^\d+(?:\s*[-–]?\s*(?:ci|cı|cü|cu)\b.*)?$/i.test(r.place))
      warnings.push("check:ranking");
    if (context.sport === "Pauerliftinq") {
      for (const key of ["bestSq", "bestBp", "bestDl", "total"])
        if (r[key] == null) warnings.push("missing:" + key);
      if (
        r.total != null &&
        [r.bestSq, r.bestBp, r.bestDl].every((x) => x != null) &&
        Math.abs(r.total - r.bestSq - r.bestBp - r.bestDl) > 0.01
      )
        warnings.push("invalid:total");
    } else {
      if (r.bestBp == null) warnings.push("missing:bestBp");
      if (r.bestSq || r.bestDl || r.total) warnings.push("invalid:sport");
    }
    const duplicateKey = [
      normalize(r.name),
      r.gender,
      r.age,
      r.weightclass,
    ].join("|");
    if (seen.has(duplicateKey)) warnings.push("duplicate:row");
    seen.add(duplicateKey);
    const match = athleteMatches(r, athletes);
    if (match.type !== "exact") warnings.push("match:" + match.type);
    const possibleRecords = records
      .filter(
        (rec) =>
          rec.sport === context.sport &&
          rec.gender === r.gender &&
          normalize(rec.wc) === normalize(r.weightclass),
      )
      .filter((rec) => {
        const v = {
          Squat: r.bestSq,
          "Benç-press": r.bestBp,
          Deadlift: r.bestDl,
          Total: r.total,
        }[rec.move];
        return (
          v != null &&
          v >
            (Number(rec.record) > 0
              ? Number(rec.record)
              : Number(rec.standard) || 0)
        );
      })
      .map((rec) => ({ id: rec.id, move: rec.move }));
    if (possibleRecords.length) warnings.push("check:possible-record");
    return {
      index,
      result: r,
      source: input.source || null,
      match,
      warnings,
      possibleRecords,
      decision: null,
    };
  });
  return { version: 1, context, rows, status: "review-required" };
}
export function approvedRows(draft, decisions, athletes) {
  if (!Array.isArray(decisions) || decisions.length !== draft.rows.length)
    throw Error("Hər sətir ayrıca yoxlanmalıdır.");
  const out = [];
  for (const row of draft.rows) {
    const d = decisions[row.index];
    if (!d || !["skip", "existing", "new"].includes(d.action))
      throw Error("İdmançı uyğunluğu üçün təsdiq tələb olunur.");
    if (d.action === "skip") continue;
    if (
      d.corrections &&
      Object.keys(d.corrections).some((k) => !FIELDS.includes(k))
    )
      throw Error("Naməlum düzəliş sahəsi.");
    let r = { ...row.result, ...d.corrections };
    const checked = draftImport([r], draft.context, athletes, []).rows[0];
    r = checked.result;
    const blockers = checked.warnings.filter(
      (w) => w.startsWith("invalid:") || w.startsWith("missing:"),
    );
    if (blockers.length)
      throw Error("Məlumatı düzəldin: " + blockers.join(", "));
    if (!d.acknowledge || typeof d.note !== "string" || !d.note.trim())
      throw Error("Yoxlama təsdiqi və qeydi tələb olunur.");
    let athleteIndex = null;
    if (d.action === "existing") {
      athleteIndex = d.athleteIndex;
      if (!Number.isInteger(athleteIndex) || !athletes[athleteIndex])
        throw Error("İdmançı tapılmadı.");
      if (
        athletes[athleteIndex].gender &&
        athletes[athleteIndex].gender !== r.gender
      )
        throw Error("İdmançı cinsi uyğun deyil.");
      r.name = athletes[athleteIndex].name;
    } else if (athleteMatches(r, athletes).type !== "new")
      throw Error(
        "Mümkün dublikat: mövcud idmançını seçin və ya adı düzəldin.",
      );
    out.push({
      sourceIndex: row.index,
      result: r,
      athleteIndex,
      newAthlete: d.action === "new",
      note: d.note.trim(),
    });
  }
  if (!out.length) throw Error("Təsdiqlənmiş nəticə yoxdur.");
  const keys = new Set();
  for (const x of out) {
    const k = [
      normalize(x.result.name),
      x.result.gender,
      x.result.age,
      x.result.weightclass,
    ].join("|");
    if (keys.has(k)) throw Error("Təkrarlanan nəticə sətiri var.");
    keys.add(k);
  }
  return out;
}
export function applyImport(baseline, draft, approved) {
  const results = structuredClone(baseline.results),
    athletes = structuredClone(baseline.athletes);
  const { context } = draft;
  for (const entry of approved) {
    const r = entry.result;
    const existing = results.some(
      (x) =>
        x.competition === context.competition &&
        x.year === context.year &&
        x.sport === context.sport &&
        normalize(x.name) === normalize(r.name),
    );
    if (existing)
      throw Error(
        "Bu yarış və idman növü üçün nəticə artıq mövcuddur; tarixçə əvəz edilmir.",
      );
    const value = {
      year: context.year,
      competition: context.competition,
      date: context.date,
      sport: context.sport,
      ...r,
      sq: ["", "", ""],
      bp: ["", "", ""],
      dl: ["", "", ""],
      absolute: "",
      coach: "",
    };
    results.push(value);
    let athlete = entry.newAthlete
      ? athletes.find((a) => normalize(a.name) === normalize(r.name))
      : athletes[entry.athleteIndex];
    if (!athlete) {
      athlete = {
        name: r.name,
        gender: r.gender,
        city: r.club,
        results: [],
        sports: [],
      };
      athletes.push(athlete);
    }
    if (!athlete.sports.includes(context.sport))
      athlete.sports.push(context.sport);
    athlete.results.push({
      "Ad Soyad": athlete.name,
      Cins: r.gender,
      "Şəhər/Klub": r.club,
      "Doğum tarixi": r.birth,
      "Yaş qrupu": r.age,
      "Çəki dərəcəsi": r.weightclass,
      İl: String(context.year),
      Yarış: context.competition,
      Yer: r.place,
      Toplam: context.sport === "Pauerliftinq" ? String(r.total) : "",
      "Ən yaxşı Bench": String(r.bestBp),
      "İdman növü": context.sport,
    });
  }
  return { results, athletes };
}

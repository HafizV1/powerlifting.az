// src/validation.mjs
var KINDS = ["news", "competitions", "protocols", "albums", "records", "recordDocuments"];
var SPORTS = ["Pauerliftinq", "Ben\xE7-press"];
var Problem = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
var fail = (message, status = 400) => {
  throw new Problem(status, message);
};
function cleanId(id) {
  if (!/^[a-z0-9-]{1,80}$/.test(id)) fail("M\u0259lumat identifikatoru etibars\u0131zd\u0131r.");
  return id;
}
var fields = {
  news: ["title", "summary", "body", "date", "dateText", "image", "status", "eventName", "eventDate", "eventVenue", "sourceUrl"],
  competitions: ["name", "startDate", "endDate", "dateText", "venue", "description", "sports", "image", "status", "sourceUrl", "badge"],
  protocols: ["title", "competitionId", "sport", "description", "status"],
  albums: ["title", "competitionId", "description", "status"],
  records: ["sport", "gender", "wc", "move", "standard", "athlete", "record", "event", "status"],
  recordDocuments: ["title", "description", "status"]
};
function date(value) {
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("Tarix YYYY-MM-DD format\u0131nda olmal\u0131d\u0131r.");
  if (value && (isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) fail("Tarix d\xFCzg\xFCn deyil.");
}
function validate(kind, input, old = {}, collections = {}) {
  if (!KINDS.includes(kind)) fail("B\xF6lm\u0259 tap\u0131lmad\u0131.", 404);
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("M\u0259lumat obyekti t\u0259l\u0259b olunur.");
  const output = { ...old };
  for (const [name, value] of Object.entries(input)) {
    if (!fields[kind].includes(name)) fail("Nam\u0259lum v\u0259 ya d\u0259yi\u015Fdiril\u0259 bilm\u0259y\u0259n sah\u0259: " + name);
    if (name === "sports") {
      if (!Array.isArray(value) || !value.length || value.length > 2 || value.some((x) => !SPORTS.includes(x))) fail("\u0130dman n\xF6v\xFCn\xFC se\xE7in.");
      output[name] = [...new Set(value)];
      continue;
    }
    if (["standard", "record"].includes(name)) {
      if (value !== "" && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 3e3)) fail("Rekord v\u0259 standart m\xFCsb\u0259t r\u0259q\u0259m olmal\u0131d\u0131r.");
      output[name] = value;
      continue;
    }
    if (typeof value !== "string" || value.length > (name === "body" ? 4e4 : 4e3)) fail("M\u0259tn etibars\u0131zd\u0131r v\u0259 ya \xE7ox uzundur.");
    output[name] = value.trim();
  }
  const title = kind === "competitions" ? "name" : "title";
  if (kind !== "records" && (!output[title] || output[title].length > 250)) fail("Ba\u015Fl\u0131q t\u0259l\u0259b olunur (\u0259n \xE7ox 250 simvol).");
  for (const name of ["date", "startDate", "endDate"]) if (name in output) date(output[name]);
  if (kind === "news" && !output.body) fail("X\u0259b\u0259rin m\u0259tnini daxil edin.");
  if (kind === "competitions") {
    if (!output.startDate || !output.endDate) fail("Ba\u015Flama v\u0259 bitm\u0259 tarixl\u0259rini daxil edin.");
    if (old.startDate && (output.startDate !== old.startDate || output.endDate !== old.endDate) && output.dateText === old.dateText) output.dateText = "";
    if (output.startDate > output.endDate) fail("Bitm\u0259 tarixi ba\u015Flama tarixind\u0259n \u0259vv\u0259l ola bilm\u0259z.");
    if (!output.sports?.length) fail("\u0130dman n\xF6v\xFCn\xFC se\xE7in.");
  }
  for (const name of ["image", "sourceUrl"]) {
    if (name in input && output[name] && output[name] !== old[name]) fail("\u015E\u0259kil v\u0259 m\u0259nb\u0259 \xFCnvan\u0131 yaln\u0131z t\u0259hl\xFCk\u0259siz fayl y\xFCkl\u0259m\u0259si vasit\u0259sil\u0259 d\u0259yi\u015Fdiril\u0259 bil\u0259r.");
  }
  if (["protocols", "albums"].includes(kind) && output.competitionId && !collections.competitions?.some((x) => x.id === output.competitionId)) fail("Yar\u0131\u015F tap\u0131lmad\u0131.");
  if (kind === "protocols" && (!output.competitionId || !SPORTS.includes(output.sport))) fail("Yar\u0131\u015F v\u0259 idman n\xF6v\xFCn\xFC se\xE7in.");
  if (kind === "records") {
    if (!SPORTS.includes(output.sport) || !["Ki\u015Fil\u0259r", "Qad\u0131nlar"].includes(output.gender) || !output.wc || !["Squat", "Ben\xE7-press", "Deadlift", "Total"].includes(output.move)) fail("Rekord kateqoriyas\u0131n\u0131 d\xFCzg\xFCn se\xE7in.");
    if (output.sport === "Ben\xE7-press" && output.move !== "Ben\xE7-press") fail("Ben\xE7-press \xFC\xE7\xFCn h\u0259r\u0259k\u0259t uy\u011Fun deyil.");
    if (typeof output.standard !== "number" || !Number.isFinite(output.standard)) fail("Standart t\u0259l\u0259b olunur.");
    if (output.record !== "" && output.record != null && (!output.athlete || !output.event)) fail("Rekord \xFC\xE7\xFCn idman\xE7\u0131 v\u0259 yar\u0131\u015F m\u0259lumat\u0131n\u0131 daxil edin.");
    if (collections.records?.some((x) => x.id !== old.id && ["sport", "gender", "wc", "move"].every((k) => x[k] === output[k]))) fail("Bu rekord kateqoriyas\u0131 art\u0131q m\xF6vcuddur.");
    if (!["G\xF6zl\u0259nilir", "M\xFCv\u0259qq\u0259ti Rekord", "R\u0259smi Rekord"].includes(output.status)) fail("Rekord statusu d\xFCzg\xFCn deyil.");
  } else {
    output.status ??= "draft";
    if (!["draft", "published"].includes(output.status)) fail("Yay\u0131m statusu d\xFCzg\xFCn deyil.");
    if (["protocols", "recordDocuments"].includes(kind) && output.status === "published" && !old.file) fail("Yay\u0131ma haz\u0131rlamaq \xFC\xE7\xFCn \u0259vv\u0259lc\u0259 s\u0259n\u0259d y\xFCkl\u0259yin.");
  }
  if (kind === "albums") output.photos = old.photos || [];
  return output;
}
function checkFile(file, kind) {
  if (!file || typeof file.arrayBuffer !== "function" || !file.size) fail("Fayl se\xE7in.");
  const image = ["news", "competitions", "albums"].includes(kind);
  if (file.size > (image ? 3 : 10) * 1024 * 1024) fail(image ? "\u015E\u0259kil \u0259n \xE7ox 3 MB ola bil\u0259r." : "S\u0259n\u0259d \u0259n \xE7ox 10 MB ola bil\u0259r.");
  const ext = file.name.split(".").pop().toLowerCase();
  const types = image ? { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" } : { pdf: "application/pdf", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel", csv: "text/csv", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  if (!types[ext] || file.type && file.type !== types[ext] && !(ext === "csv" && file.type === "application/vnd.ms-excel")) fail("Fayl n\xF6v\xFC d\u0259st\u0259kl\u0259nmir. SVG v\u0259 HTML q\u0259bul edilmir.");
  return { ext: ext === "jpeg" ? "jpg" : ext, mime: types[ext], image };
}
function checkSignature(bytes, ext) {
  const ascii = new TextDecoder("latin1").decode(bytes.slice(0, 16));
  const valid = ext === "png" ? bytes[0] === 137 && ascii.slice(1, 4) === "PNG" : ext === "jpg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : ext === "webp" ? ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP" : ext === "pdf" ? ascii.startsWith("%PDF-") : ["xlsx", "docx"].includes(ext) ? bytes[0] === 80 && bytes[1] === 75 && bytes[2] === 3 && bytes[3] === 4 : ext === "xls" ? bytes.slice(0, 8).every((b, i) => b === [208, 207, 17, 224, 161, 177, 26, 225][i]) : ext === "csv" ? !bytes.includes(0) && !/^\s*</.test(new TextDecoder().decode(bytes)) : false;
  if (!valid) fail("Fayl m\u0259zmunu onun n\xF6v\xFCn\u0259 uy\u011Fun deyil.");
  if (ext === "csv") {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      fail("CSV UTF-8 kodla\u015Fd\u0131rmas\u0131nda olmal\u0131d\u0131r.");
    }
  }
}

// src/security.mjs
var encoder = new TextEncoder();
var COOKIE = "__Host-pl-admin";
var random = () => crypto.randomUUID();
function b64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}
function unb64(value) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
function base64url(bytes) {
  return b64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function unurl(value) {
  return unb64(value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4));
}
async function key(secret) {
  if (typeof secret !== "string" || encoder.encode(secret).length < 32) throw new Error("SESSION_SECRET must contain at least 32 bytes");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function sign(payload, secret) {
  const body2 = base64url(encoder.encode(JSON.stringify(payload)));
  return body2 + "." + base64url(new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(body2))));
}
async function verify(value, secret) {
  try {
    if (!value || value.length > 4096) return null;
    const [body2, signature, ...extra] = value.split(".");
    if (extra.length || !await crypto.subtle.verify("HMAC", await key(secret), unurl(signature), encoder.encode(body2))) return null;
    const payload = JSON.parse(new TextDecoder().decode(unurl(body2)));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}
function local(env, url) {
  return !!env.LOCAL_STORE && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
}
function cookieName(env, url) {
  return local(env, url) ? "pl-admin-local" : COOKIE;
}
function cookies(request) {
  return Object.fromEntries((request.headers.get("Cookie") || "").split(";").map((x) => x.trim().split(/=(.*)/s)).filter((x) => x.length > 1).map((x) => [x[0], x[1]]));
}
function cookie(name, value, { secure = true, maxAge = 7200, sameSite = "Strict" } = {}) {
  return `${name}=${value}; Path=/; HttpOnly; ${secure ? "Secure; " : ""}SameSite=${sameSite}; Max-Age=${maxAge}`;
}
function origin(env, url) {
  const expected = new URL(env.PUBLIC_ORIGIN);
  if (expected.origin !== url.origin || !local(env, url) && expected.protocol !== "https:") throw new Error("PUBLIC_ORIGIN mismatch");
  return expected.origin;
}
function authorized(session, env, url) {
  if (!session) return false;
  if (local(env, url) && session.local === true) return true;
  return !session.local && String(env.ADMIN_USER_IDS || "").split(",").map((x) => x.trim()).filter(Boolean).includes(String(session.id));
}
function securityHeaders() {
  return { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'", "Permissions-Policy": "camera=(), microphone=(), geolocation=()" };
}

// src/render-v1.mjs
var esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var published = (items) => items.filter((x) => x.status === "published");
var paragraphs = (text) => String(text || "").split(/\n\s*\n/).filter(Boolean).map((p) => "<p>" + esc(p).replaceAll("\n", "<br>") + "</p>").join("");
var date2 = (competition) => competition.dateText || `${competition.startDate} \u2013 ${competition.endDate}`;
var docs = (items) => items.filter((x) => x.file).map((x) => `<p><a href="${esc(x.file.path)}" download>${esc(x.title)}</a>${x.description ? " \u2014 " + esc(x.description) : ""}</p>`).join("");
function replaceMain(source, html) {
  if (!/<main\b[^>]*>[\s\S]*?<\/main>/.test(source)) throw new Error("Source main not found");
  return source.replace(/<main\b[^>]*>[\s\S]*?<\/main>/, () => html);
}
function renderV1(base, collections) {
  const outputs = {};
  const news = published(collections.news).map((x) => `<article class="news-card">${x.image ? `<div class="news-image"><img src="${esc(x.image)}" alt="${esc(x.title)}"></div>` : ""}<div class="news-copy"><div class="news-date">${esc(x.dateText || x.date)}</div><h2>${esc(x.title)}</h2>${x.summary ? "<p>" + esc(x.summary) + "</p>" : ""}${paragraphs(x.body)}${x.eventName || x.eventDate || x.eventVenue ? `<div class="event-meta">${[["Yar\u0131\u015F", x.eventName], ["Tarix", x.eventDate], ["Yer", x.eventVenue]].filter(([, v]) => v).map(([k, v]) => `<div><b>${k}:</b> ${esc(v)}</div>`).join("")}</div>` : ""}</div></article>`).join("");
  outputs["xeberler.html"] = replaceMain(base["xeberler.html"], `<main class="news-main"><div class="wrap">${news}</div></main>`);
  const competitions = published(collections.competitions).map((x) => `<article class="race-card">${x.image ? `<div class="race-poster"><img src="${esc(x.image)}" alt="${esc(x.name)}"></div>` : ""}<div class="race-info"><div class="race-top"><h3>${esc(x.name)}</h3>${x.badge ? `<span class="badge">${esc(x.badge)}</span>` : ""}</div><div class="rmeta"><span>\u25A3 ${esc(date2(x))}</span>${x.venue ? "<span>\u25CF " + esc(x.venue) + "</span>" : ""}<span>\u{1F3C6} ${x.sports.map(esc).join(" \xB7 ")}</span></div><div class="race-actions"><a class="primary" href="neticeler.html">N\u0259tic\u0259l\u0259r v\u0259 protokollar \u2192</a><a class="secondary" href="${esc(x.sourceUrl || "yaris-" + x.id + ".html")}">Yar\u0131\u015F haqq\u0131nda</a></div></div></article>`).join("");
  const toolbar = base["yarislar.html"].match(/<div class="race-toolbar">[\s\S]*?<\/div><\/div>/)?.[0] || "";
  outputs["yarislar.html"] = replaceMain(base["yarislar.html"], `<main class="content"><div class="wrap">${toolbar}<div class="race-list">${competitions}</div></div></main>`);
  const records = collections.records.map(({ id, ...row }) => row);
  if (!/const RECORDS=\[[\s\S]*?\];/.test(base["rekordlar.html"])) throw new Error("Records source not found");
  outputs["rekordlar.html"] = base["rekordlar.html"].replace(/const RECORDS=\[[\s\S]*?\];/, () => `const RECORDS=${JSON.stringify(records).replaceAll("<", "\\u003c")};`);
  const protocols = published(collections.protocols);
  const sections = ["Pauerliftinq", "Ben\xE7-press"].map((s) => {
    const items = protocols.filter((x) => x.sport === s);
    return items.length ? `<section class="wrap"><h2>${s} \u2014 protokollar</h2>${docs(items)}</section>` : "";
  }).join("");
  outputs["neticeler.html"] = base["neticeler.html"].replace(/(<main\b[^>]*>)/, (match) => match + sections);
  const recordDocs = docs(published(collections.recordDocuments));
  if (recordDocs) outputs["rekord-qaydalari.html"] = base["rekord-qaydalari.html"].replace("</main>", `<section class="wrap"><h2>Rekord s\u0259n\u0259dl\u0259ri</h2>${recordDocs}</section></main>`);
  const albums = published(collections.albums);
  const gallery = albums.map((x) => `<section><h2>${esc(x.title)}</h2>${paragraphs(x.description)}<div class="cards">${x.photos.map((p) => `<figure class="card"><img src="${esc(p.path)}" alt="${esc(p.alt)}" width="100%"><figcaption>${esc(p.caption)}</figcaption></figure>`).join("")}</div></section>`).join("");
  outputs["qalereya.html"] = replaceMain(base["xeberler.html"], `<main class="content"><div class="wrap">${gallery}</div></main>`).replace(/<title>.*?<\/title>/, "<title>Foto qalereya | Az\u0259rbaycan Pauerliftinq B\xF6lm\u0259si</title>");
  for (const x of published(collections.competitions)) {
    const album = albums.filter((a) => a.competitionId === x.id);
    const files = docs(protocols.filter((p) => p.competitionId === x.id));
    const html = `<main class="content"><div class="wrap"><h1>${esc(x.name)}</h1><p><strong>Tarix: </strong>${esc(date2(x))}</p><p><strong>M\u0259kan: </strong>${esc(x.venue)}</p><p><strong>\u0130dman n\xF6v\xFC: </strong>${x.sports.map(esc).join(" \xB7 ")}</p>${x.image ? `<img src="${esc(x.image)}" alt="${esc(x.name)}" style="max-width:420px;width:100%;height:auto;border-radius:8px">` : ""}${paragraphs(x.description)}${files}${album.length ? '<p><a href="qalereya.html">Foto qalereya</a></p>' : ""}<a href="neticeler.html">N\u0259tic\u0259l\u0259r v\u0259 protokollar \u2192</a></div></main>`;
    const filename = x.sourceUrl || "yaris-" + x.id + ".html";
    outputs[filename] = replaceMain(base[filename] || base["cempionat-2026-haqqinda.html"], html);
  }
  return outputs;
}

// src/github.mjs
var enc = new TextEncoder();
var dec = new TextDecoder();
var caches = /* @__PURE__ */ new WeakMap();
var requestOf = (env) => env.FETCH || fetch;
function privateKeyBytes(pem) {
  const rsa = pem.includes("-----BEGIN RSA PRIVATE KEY-----");
  const raw = unb64(pem.replaceAll("\\n", "\n").replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----|-----END (?:RSA )?PRIVATE KEY-----|\s/g, ""));
  if (!rsa) return raw;
  const der = (tag, bytes) => {
    let n = bytes.length, a = [];
    do {
      a.unshift(n & 255);
      n = Math.floor(n / 256);
    } while (n);
    return new Uint8Array([tag, ...bytes.length < 128 ? [bytes.length] : [128 + a.length, ...a], ...bytes]);
  };
  const algorithm = [48, 13, 6, 9, 42, 134, 72, 134, 247, 13, 1, 1, 1, 5, 0];
  return der(48, new Uint8Array([2, 1, 0, ...algorithm, ...der(4, raw)]));
}
async function appJWT(env) {
  for (const name of ["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY"]) if (!env[name]) fail("GitHub App ID v\u0259 ya private key konfiqurasiyas\u0131 yoxdur.", 503);
  const header = base64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const now = Math.floor(Date.now() / 1e3), body2 = base64url(enc.encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(env.GITHUB_APP_ID).trim() })));
  const key2 = await crypto.subtle.importKey("pkcs8", privateKeyBytes(env.GITHUB_APP_PRIVATE_KEY), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const jwt = header + "." + body2 + "." + base64url(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key2, enc.encode(header + "." + body2))));
  return jwt;
}
async function oauthClientId(env) {
  if (env.STAGING_ONLY !== "true") {
    const id = String(env.GITHUB_CLIENT_ID || "").trim();
    if (!id) fail("GitHub Client ID yoxdur.", 503);
    return id;
  }
  const jwt = await appJWT(env);
  const response = await requestOf(env)("https://api.github.com/app", { headers: { Authorization: "Bearer " + jwt, Accept: "application/vnd.github+json", "User-Agent": "powerlifting-admin-v2", "X-GitHub-Api-Version": "2022-11-28" }, signal: AbortSignal.timeout(2e4) });
  if (!response.ok) fail("GitHub App ID/private key t\u0259sdiql\u0259nm\u0259di. Giri\u015F dayand\u0131r\u0131ld\u0131.", 503);
  const app = await response.json();
  if (String(app.id) !== String(env.GITHUB_APP_ID).trim() || app.slug !== "powerlifting-v2-staging-admin" || typeof app.client_id !== "string" || !app.client_id.trim()) fail("G\xF6zl\u0259nil\u0259n staging GitHub App t\u0259sdiql\u0259nm\u0259di.", 503);
  return app.client_id.trim();
}
async function appToken(env) {
  const cached = caches.get(env);
  if (cached && cached.until > Date.now() + 6e4) return cached.token;
  for (const name of ["GITHUB_INSTALLATION_ID", "GITHUB_REPOSITORY"]) if (!env[name]) fail("GitHub App konfiqurasiyas\u0131 tamamlanmay\u0131b.", 503);
  const jwt = await appJWT(env);
  const repo = env.GITHUB_REPOSITORY.split("/")[1];
  const response = await requestOf(env)(`https://api.github.com/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`, { method: "POST", headers: { Authorization: "Bearer " + jwt, Accept: "application/vnd.github+json", "User-Agent": "powerlifting-admin-v2", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" }, body: JSON.stringify({ repositories: [repo], permissions: { contents: "write", pull_requests: "write" } }), signal: AbortSignal.timeout(2e4) });
  if (!response.ok) fail("GitHub App icaz\u0259l\u0259ri v\u0259 ya a\xE7ar\u0131 d\xFCzg\xFCn deyil.", 503);
  const value = await response.json();
  if (!value.token) fail("GitHub tokeni al\u0131nmad\u0131.", 503);
  caches.set(env, { token: value.token, until: Date.parse(value.expires_at) });
  return value.token;
}
var GitHubStore = class {
  constructor(env) {
    this.env = env;
    this.repo = env.GITHUB_REPOSITORY;
    this.branch = env.DATA_BRANCH;
    this.base = env.BASE_BRANCH;
  }
  async api(path, method = "GET", body2, optional = false) {
    const token = await appToken(this.env);
    const r = await requestOf(this.env)(`https://api.github.com/repos/${this.repo}${path ? "/" + path : ""}`, { method, headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "powerlifting-admin-v2", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" }, ...body2 === void 0 ? {} : { body: JSON.stringify(body2) }, signal: AbortSignal.timeout(2e4) });
    if (optional && r.status === 404) return null;
    if (!r.ok) {
      if ([409, 422].includes(r.status)) throw new Problem(409, "Ba\u015Fqa d\u0259yi\u015Fiklik saxlan\u0131l\u0131b. S\u0259hif\u0259ni yenil\u0259yib t\u0259krar yoxlay\u0131n.");
      fail([401, 403].includes(r.status) ? "GitHub App \xFC\xE7\xFCn repozitoriya icaz\u0259si yoxdur." : "GitHub sor\u011Fusu u\u011Fursuz oldu. Yenid\u0259n c\u0259hd edin.", 502);
    }
    return r.status === 204 ? null : r.json();
  }
  async guard() {
    if (this.env.STAGING_ONLY === "true" && (this.repo !== "HafizV1/powerlifting-v1-preview" || this.base !== "v2/staging-base" || this.env.ENABLE_V1_EXPORT !== "false")) fail("Staging yaln\u0131z preview repozitoriyas\u0131 v\u0259 s\xF6nd\xFCr\xFClm\xFC\u015F yay\u0131m il\u0259 i\u015Fl\u0259yir.", 503);
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(this.repo || "") || !/^v2\/content-[a-z0-9-]+$/.test(this.branch || "") || !this.base || this.base === this.branch) fail("T\u0259hl\xFCk\u0259siz m\u0259zmun buda\u011F\u0131 konfiqurasiyas\u0131 t\u0259l\u0259b olunur.", 503);
    const repo = await this.api("");
    if (this.branch === repo.default_branch || ["main", "master", "gh-pages"].includes(this.branch)) fail("\u0130stehsal buda\u011F\u0131na yazmaq qada\u011Fand\u0131r.", 403);
  }
  async head(branch) {
    return this.api("git/ref/heads/" + encodeURIComponent(branch), "GET", void 0, true);
  }
  async blob(sha) {
    const blob = await this.api("git/blobs/" + sha);
    return unb64(blob.content.replace(/\s/g, ""));
  }
  async load() {
    await this.guard();
    let ref = await this.head(this.branch);
    const exists = !!ref;
    ref ??= await this.head(this.base);
    if (!ref) fail("Ba\u015Flan\u011F\u0131c buda\u011F\u0131 tap\u0131lmad\u0131.", 503);
    const revision = ref.object.sha, commit = await this.api("git/commits/" + revision), tree = await this.api("git/trees/" + commit.tree.sha + "?recursive=1");
    if (tree.truncated) fail("Repozitoriya a\u011Fac\u0131 \xE7ox b\xF6y\xFCkd\xFCr.", 503);
    const collections = {};
    await Promise.all(KINDS.map(async (kind) => {
      const entry = tree.tree.find((x) => x.path === `content/v2/${kind}.json` && x.type === "blob");
      if (!entry) fail("V2 m\u0259zmun fayllar\u0131 ba\u015Flan\u011F\u0131c buda\u011F\u0131nda yoxdur.", 503);
      collections[kind] = JSON.parse(dec.decode(await this.blob(entry.sha)));
      if (!Array.isArray(collections[kind])) fail("M\u0259zmun fayl\u0131 z\u0259d\u0259l\u0259nib.", 503);
    }));
    return { collections, revision, tree: commit.tree.sha, exists, entries: tree.tree };
  }
  async save(state, kind, assets, deletions, actor) {
    if (!KINDS.includes(kind)) fail("M\u0259zmun b\xF6lm\u0259si etibars\u0131zd\u0131r.");
    await this.guard();
    const latest = await this.head(this.branch);
    if (latest && latest.object.sha !== state.revision) throw new Problem(409, "M\u0259lumat d\u0259yi\u015Fib. Yenil\u0259yib t\u0259krar yoxlay\u0131n.");
    if (!latest) {
      const base = await this.head(this.base);
      if (base?.object.sha !== state.revision) throw new Problem(409, "Ba\u015Flan\u011F\u0131c buda\u011F\u0131 d\u0259yi\u015Fib. M\u0259lumat\u0131 yenil\u0259yin.");
      await this.api("git/refs", "POST", { ref: "refs/heads/" + this.branch, sha: state.revision });
    }
    const path = `content/v2/${kind}.json`;
    const tree = [{ path, mode: "100644", type: "blob", content: JSON.stringify(state.collections[kind], null, 2) + "\n" }];
    for (const asset of assets) {
      if (!/^assets\/uploads\/(news|competitions|albums|protocols|recordDocuments)\/[a-z0-9-]+\/[a-z0-9-]+\.(webp|png|jpg|pdf|xlsx|xls|csv|docx)$/.test(asset.path)) fail("Fayl \xFCnvan\u0131 qada\u011Fand\u0131r.");
      const blob = await this.api("git/blobs", "POST", { content: asset.base64, encoding: "base64" });
      tree.push({ path: asset.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    for (const path2 of deletions) {
      if (!/^assets\/uploads\/(news|competitions|albums|protocols|recordDocuments)\/[a-z0-9-]+\/[a-z0-9-]+\.(webp|png|jpg|pdf|xlsx|xls|csv|docx)$/.test(path2)) fail("M\u0259nb\u0259 fayl\u0131n\u0131 silm\u0259k qada\u011Fand\u0131r.");
      tree.push({ path: path2, mode: "100644", type: "blob", sha: null });
    }
    if (this.env.ENABLE_V1_EXPORT === "true") {
      const base = {}, names = ["xeberler.html", "yarislar.html", "rekordlar.html", "neticeler.html", "rekord-qaydalari.html", "cempionat-2026-haqqinda.html", "kubok-2025-haqqinda.html", "kubok-2026-haqqinda.html"];
      await Promise.all(names.map(async (name) => {
        const entry = state.entries.find((x) => x.path === name && x.type === "blob");
        if (!entry) fail("V1 ixrac \u015Fablonu tap\u0131lmad\u0131.", 503);
        base[name] = dec.decode(await this.blob(entry.sha));
      }));
      const rendered = renderV1(base, state.collections);
      const details = Object.keys(rendered).filter((x) => !["xeberler.html", "yarislar.html", "rekordlar.html", "neticeler.html", "rekord-qaydalari.html", "qalereya.html"].includes(x));
      const changed = { news: ["xeberler.html"], competitions: ["yarislar.html", ...details], protocols: ["neticeler.html", ...details], albums: ["qalereya.html", ...details], records: ["rekordlar.html"], recordDocuments: ["rekord-qaydalari.html"] }[kind];
      for (const name of changed) {
        if (!rendered[name] || rendered[name] === base[name]) continue;
        if (!names.includes(name) && name !== "qalereya.html" && !/^yaris-competitions-[a-z0-9-]+\.html$/.test(name)) fail("\u0130xrac fayl\u0131na yazmaq qada\u011Fand\u0131r.");
        tree.push({ path: name, mode: "100644", type: "blob", content: rendered[name] });
      }
    }
    const createdTree = await this.api("git/trees", "POST", { base_tree: state.tree, tree });
    const commit = await this.api("git/commits", "POST", { message: `V2 ${kind}: ${actor.login} t\u0259r\u0259find\u0259n m\u0259zmun yenil\u0259nm\u0259si`, tree: createdTree.sha, parents: [state.revision] });
    await this.api("git/refs/heads/" + encodeURIComponent(this.branch), "PATCH", { sha: commit.sha, force: false });
    return commit.sha;
  }
  async review() {
    await this.guard();
    const ref = await this.head(this.branch);
    if (!ref) return null;
    const owner = this.repo.split("/")[0];
    const prs = await this.api("pulls?state=open&head=" + encodeURIComponent(owner + ":" + this.branch) + "&base=" + encodeURIComponent(this.base));
    if (prs.length) return prs[0].html_url;
    const pr = await this.api("pulls", "POST", { title: "V2: idar\u0259etm\u0259 panelind\u0259n m\u0259zmun d\u0259yi\u015Fiklikl\u0259ri", head: this.branch, base: this.base, draft: true, body: "\u0130dar\u0259etm\u0259 paneli t\u0259r\u0259find\u0259n haz\u0131rlanm\u0131\u015F m\u0259zmun. D\u0259yi\u015Fiklikl\u0259ri yoxlay\u0131n; avtomatik birl\u0259\u015Fdirm\u0259 v\u0259 yay\u0131m yoxdur. V1 fayllar\u0131 v\u0259 idman\xE7\u0131 bazas\u0131 d\u0259yi\u015Fdirilmir." });
    return pr.html_url;
  }
  async asset(path) {
    await this.guard();
    const ref = await this.head(this.branch) || await this.head(this.base);
    if (!ref) fail("Budaq tap\u0131lmad\u0131.", 503);
    const commit = await this.api("git/commits/" + ref.object.sha), tree = await this.api("git/trees/" + commit.tree.sha + "?recursive=1");
    if (tree.truncated) fail("Repozitoriya a\u011Fac\u0131 \xE7ox b\xF6y\xFCkd\xFCr.", 503);
    const entry = tree.tree.find((x) => x.path === path && x.type === "blob");
    if (!entry) fail("Fayl tap\u0131lmad\u0131.", 404);
    return this.blob(entry.sha);
  }
};

// src/worker.mjs
var JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
var json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { ...securityHeaders(), ...JSON_HEADERS, ...headers } });
var redirect = (location, cookieValue) => new Response(null, { status: 302, headers: { ...securityHeaders(), Location: location, ...cookieValue ? { "Set-Cookie": cookieValue } : {} } });
function refs(collections) {
  return new Set(JSON.stringify(collections).match(/assets\/uploads\/[a-zA-Z0-9/_.-]+/g) || []);
}
async function body(request) {
  const bytes = await limited(request, 1e5);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    fail("JSON m\u0259lumat\u0131 d\xFCzg\xFCn deyil.");
  }
}
async function limited(request, max) {
  if (Number(request.headers.get("Content-Length")) > max) fail("Sor\u011Fu \xE7ox b\xF6y\xFCkd\xFCr.", 413);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  let total = 0, chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) {
        await reader.cancel();
        fail("Sor\u011Fu \xE7ox b\xF6y\xFCkd\xFCr.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
async function handle(request, env) {
  const url = new URL(request.url);
  try {
    const siteOrigin = origin(env, url), isLocal = local(env, url), name = cookieName(env, url);
    const session = await verify(cookies(request)[name], env.SESSION_SECRET);
    if (url.pathname === "/api/session" && request.method === "GET") return json(authorized(session, env, url) ? { user: { id: session.id, login: session.login }, csrf: session.csrf, local: isLocal } : { user: null, local: isLocal });
    const unsafe = !["GET", "HEAD"].includes(request.method);
    if (unsafe && request.headers.get("Origin") !== siteOrigin) fail("Sor\u011Fu m\u0259nb\u0259yi etibars\u0131zd\u0131r.", 403);
    if (url.pathname === "/api/auth/check" && request.method === "GET") {
      const id = await oauthClientId(env);
      return json({ appVerified: env.STAGING_ONLY === "true", configuredClientMatches: !!env.GITHUB_CLIENT_ID && String(env.GITHUB_CLIENT_ID).trim() === id, callback: siteOrigin + "/api/auth/callback", authorizeEndpoint: "https://github.com/login/oauth/authorize", clientSecretPresent: !!env.GITHUB_CLIENT_SECRET });
    }
    if (url.pathname === "/api/auth/local" && request.method === "POST") {
      if (!isLocal) fail("Yerli test giri\u015Fi m\xF6vcud deyil.", 404);
      const value = { id: "local", login: "Yerli test administratoru", local: true, csrf: random(), exp: Date.now() + 72e5 };
      return json({ ok: true }, 200, { "Set-Cookie": cookie(name, await sign(value, env.SESSION_SECRET), { secure: false }) });
    }
    if (url.pathname === "/api/auth/github" && request.method === "GET") {
      if (!env.GITHUB_CLIENT_SECRET) fail("GitHub giri\u015F konfiqurasiyas\u0131 tamamlanmay\u0131b.", 503);
      const clientId = await oauthClientId(env), state2 = random();
      const signed = await sign({ state: state2, clientId, exp: Date.now() + 6e5 }, env.SESSION_SECRET);
      const auth = new URL("https://github.com/login/oauth/authorize");
      auth.searchParams.set("client_id", clientId);
      auth.searchParams.set("redirect_uri", siteOrigin + "/api/auth/callback");
      auth.searchParams.set("state", state2);
      return redirect(auth.href, cookie("__Host-pl-oauth", signed, { sameSite: "Lax", maxAge: 600 }));
    }
    if (url.pathname === "/api/auth/callback" && request.method === "GET") {
      const state2 = await verify(cookies(request)["__Host-pl-oauth"], env.SESSION_SECRET);
      if (!state2 || !state2.clientId || state2.state !== url.searchParams.get("state") || !url.searchParams.get("code")) fail("Giri\u015F sor\u011Fusunun m\xFCdd\u0259ti bitib v\u0259 ya etibars\u0131zd\u0131r.", 403);
      const fetcher = env.FETCH || fetch;
      const tokenResponse = await fetcher("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: state2.clientId, client_secret: String(env.GITHUB_CLIENT_SECRET).trim(), code: url.searchParams.get("code"), redirect_uri: siteOrigin + "/api/auth/callback" }), signal: AbortSignal.timeout(2e4) });
      if (!tokenResponse.ok) fail("GitHub giri\u015Fi u\u011Fursuz oldu.", 502);
      const token = await tokenResponse.json();
      if (!token.access_token) fail("GitHub giri\u015Fi u\u011Fursuz oldu.", 403);
      const userResponse = await fetcher("https://api.github.com/user", { headers: { Authorization: "Bearer " + token.access_token, "User-Agent": "powerlifting-admin-v2", Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(2e4) });
      if (!userResponse.ok) fail("GitHub istifad\u0259\xE7isi yoxlan\u0131lmad\u0131.", 502);
      const user = await userResponse.json(), value = { id: String(user.id), login: user.login, csrf: random(), exp: Date.now() + 72e5 };
      if (!authorized(value, env, url)) fail("Bu istifad\u0259\xE7inin idar\u0259etm\u0259 icaz\u0259si yoxdur.", 403);
      const response = redirect("/", cookie(name, await sign(value, env.SESSION_SECRET)));
      response.headers.append("Set-Cookie", cookie("__Host-pl-oauth", "", { sameSite: "Lax", maxAge: 0 }));
      return response;
    }
    if (!authorized(session, env, url)) fail("\u0130dar\u0259etm\u0259 \xFC\xE7\xFCn daxil olun.", 401);
    if (unsafe && request.headers.get("X-CSRF-Token") !== session.csrf) fail("T\u0259hl\xFCk\u0259sizlik yoxlamas\u0131 u\u011Fursuz oldu. Yenid\u0259n daxil olun.", 403);
    if (url.pathname === "/api/auth/logout" && request.method === "POST") return json({ ok: true }, 200, { "Set-Cookie": cookie(name, "", { secure: !isLocal, maxAge: 0 }) });
    const store = env.LOCAL_STORE || new GitHubStore(env);
    if (url.pathname === "/api/content" && request.method === "GET") {
      const state2 = await store.load();
      return json({ collections: state2.collections, revision: state2.revision, local: isLocal, renderingEnabled: env.ENABLE_V1_EXPORT === "true" });
    }
    if (url.pathname === "/api/review" && request.method === "POST") return json({ url: await store.review() });
    if (url.pathname === "/api/assets" && request.method === "GET") {
      const path = url.searchParams.get("path") || "";
      if (!/^(assets\/uploads\/[a-zA-Z0-9/_.-]+|assets\/images\/[a-zA-Z0-9_.-]+)$/.test(path) || path.includes("..")) fail("Fayl \xFCnvan\u0131 etibars\u0131zd\u0131r.");
      const ext = path.split(".").pop(), types = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", pdf: "application/pdf", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel", csv: "text/csv", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
      if (!types[ext]) fail("Fayl n\xF6v\xFC d\u0259st\u0259kl\u0259nmir.");
      return new Response(await store.asset(path), { headers: { ...securityHeaders(), "Content-Type": types[ext], ...!types[ext].startsWith("image/") ? { "Content-Disposition": 'attachment; filename="' + path.split("/").pop() + '"' } : {} } });
    }
    const match = url.pathname.match(/^\/api\/content\/([A-Za-z]+)(?:\/([a-z0-9-]+))?(?:\/photos\/([a-z0-9-]+))?$/);
    const upload = url.pathname === "/api/uploads" && request.method === "POST";
    if (!match && !upload) fail("Sor\u011Fu tap\u0131lmad\u0131.", 404);
    if (!unsafe) fail("Sor\u011Fu \xFCsulu d\u0259st\u0259kl\u0259nmir.", 405);
    const state = await store.load();
    if (request.headers.get("If-Match") !== state.revision) fail("M\u0259lumat d\u0259yi\u015Fib. Yenil\u0259yib t\u0259krar yoxlay\u0131n.", 409);
    const before = refs(state.collections), assets = [];
    let kind, item;
    if (upload) {
      const bytes = await limited(request, 15 * 1024 * 1024);
      const form = await new Request(request.url, { method: "POST", headers: { "Content-Type": request.headers.get("Content-Type") || "" }, body: bytes }).formData();
      kind = form.get("kind");
      const id = cleanId(String(form.get("id") || ""));
      if (!["news", "competitions", "protocols", "albums", "recordDocuments"].includes(kind)) fail("Bu b\xF6lm\u0259y\u0259 fayl y\xFCkl\u0259nmir.");
      item = state.collections[kind].find((x) => x.id === id);
      if (!item) fail("\u018Fvv\u0259lc\u0259 m\u0259lumat\u0131 saxlay\u0131n.", 404);
      const files = form.getAll("files");
      if (!files.length || files.length > (kind === "albums" ? 20 : 1)) fail("Fayl say\u0131n\u0131 yoxlay\u0131n (albom \xFC\xE7\xFCn \u0259n \xE7ox 20).");
      for (const file of files) {
        const info = checkFile(file, kind), bytes2 = new Uint8Array(await file.arrayBuffer());
        checkSignature(bytes2, info.ext);
        const assetId = random(), path = `assets/uploads/${kind}/${id}/${assetId}.${info.ext}`;
        let binary = "";
        for (let i = 0; i < bytes2.length; i += 32768) binary += String.fromCharCode(...bytes2.subarray(i, i + 32768));
        assets.push({ path, base64: btoa(binary) });
        if (kind === "albums") item.photos.push({ id: assetId, path, alt: "", caption: "" });
        else if (info.image) item.image = path;
        else item.file = { path, name: file.name.replace(/[\u0000-\u001f\/\\]/g, "_").slice(0, 200), mime: info.mime, size: file.size };
      }
    } else {
      [, kind] = match;
      if (!KINDS.includes(kind)) fail("B\xF6lm\u0259 tap\u0131lmad\u0131.", 404);
      const id = match[2] ? cleanId(match[2]) : null, index = state.collections[kind].findIndex((x) => x.id === id);
      if (match[3]) {
        if (kind !== "albums" || index < 0) fail("Albom tap\u0131lmad\u0131.", 404);
        item = state.collections.albums[index];
        const photo = item.photos.find((x) => x.id === match[3]);
        if (!photo) fail("\u015E\u0259kil tap\u0131lmad\u0131.", 404);
        if (request.method === "DELETE") item.photos = item.photos.filter((x) => x.id !== photo.id);
        else if (request.method === "PATCH") {
          const input = await body(request);
          if (Object.keys(input).some((x) => !["alt", "caption"].includes(x))) fail("\u015E\u0259kil sah\u0259si etibars\u0131zd\u0131r.");
          for (const key2 of ["alt", "caption"]) if (key2 in input) {
            if (typeof input[key2] !== "string" || input[key2].length > 1e3) fail("\u015E\u0259kil m\u0259tni \xE7ox uzundur.");
            photo[key2] = input[key2].trim();
          }
        } else fail("Sor\u011Fu \xFCsulu d\u0259st\u0259kl\u0259nmir.", 405);
      } else if (request.method === "POST" && !id) {
        item = validate(kind, await body(request), {}, state.collections);
        item.id = kind.toLowerCase() + "-" + random();
        state.collections[kind].push(item);
      } else if (request.method === "PATCH" && index >= 0) {
        item = validate(kind, await body(request), state.collections[kind][index], state.collections);
        state.collections[kind][index] = item;
      } else if (request.method === "DELETE" && index >= 0) {
        if (kind === "records") fail("Rekord kateqoriyas\u0131 silinmir. Rekord m\u0259lumat\u0131n\u0131 redakt\u0259 edin.", 403);
        if (kind === "competitions" && ["protocols", "albums"].some((k) => state.collections[k].some((x) => x.competitionId === id))) fail("\u018Fvv\u0259lc\u0259 yar\u0131\u015F\u0131n albom v\u0259 protokol \u0259laq\u0259l\u0259rini d\u0259yi\u015Fin.", 409);
        state.collections[kind].splice(index, 1);
      } else fail("M\u0259lumat v\u0259 ya sor\u011Fu \xFCsulu tap\u0131lmad\u0131.", 404);
    }
    const after = refs(state.collections), deletions = [...before].filter((x) => !after.has(x));
    const revision = await store.save(state, kind, assets, deletions, session);
    return json({ item, revision, reviewNeeded: true }, request.method === "POST" ? 201 : 200);
  } catch (error) {
    return json({ error: error instanceof Problem ? error.message : "Xidm\u0259t konfiqurasiyas\u0131n\u0131 v\u0259 ba\u011Flant\u0131n\u0131 yoxlay\u0131n.", ...error instanceof Problem ? {} : { code: "CONFIGURATION_OR_UPSTREAM_FAILURE" } }, error instanceof Problem ? error.status : 503);
  }
}
var worker_default = { async fetch(request, env) {
  if (new URL(request.url).pathname.startsWith("/api/")) return handle(request, env);
  const response = await env.ASSETS.fetch(request);
  const secured = new Response(response.body, response);
  for (const [key2, value] of Object.entries(securityHeaders())) secured.headers.set(key2, value);
  return secured;
} };

// scripts/browser-worker-assets.generated.mjs
var BROWSER_ASSETS = { "/index.html": { "type": "text/html; charset=utf-8", "body": '<!doctype html>\n<html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>\u0130dar\u0259etm\u0259 \u2014 Az\u0259rbaycan Pauerliftinq B\xF6lm\u0259si</title><link rel="stylesheet" href="/admin.css"><script type="module" src="/admin.js"><\/script></head>\n<body><div id="notice" role="status" aria-live="polite"></div><main id="login" class="login"><div class="login-card"><div class="brand-mark">AZ</div><p class="eyebrow">AZ\u018FRBAYCAN PAUERL\u0130FT\u0130NQ B\xD6LM\u018FS\u0130</p><h1>\u0130dar\u0259etm\u0259 paneli</h1><p>Yaln\u0131z s\u0259lahiyy\u0259tli administratorlar \xFC\xE7\xFCn t\u0259hl\xFCk\u0259siz giri\u015F.</p><a class="button" href="/api/auth/github">GitHub il\u0259 daxil ol</a><button id="local-login" hidden>Yerli test rejimin\u0259 daxil ol</button><p id="local-description" hidden>Bu rejim yaln\u0131z bu komp\xFCterd\u0259 i\u015Fl\u0259yir. Canl\u0131 sayta v\u0259 GitHub-a yazm\u0131r.</p></div></main>\n<div id="application" hidden><header><div><strong>Az\u0259rbaycan Pauerliftinq B\xF6lm\u0259si</strong><span>\u0130dar\u0259etm\u0259 paneli \xB7 V2</span></div><div class="account"><span id="user"></span><button id="logout" class="quiet">\xC7\u0131x\u0131\u015F</button></div></header><div class="shell"><nav id="navigation" aria-label="\u0130dar\u0259etm\u0259 b\xF6lm\u0259l\u0259ri"></nav><main id="workspace"><div class="workspace-top"><div><p class="eyebrow">M\u018FZMUNUN \u0130DAR\u018F ED\u0130LM\u018FS\u0130</p><h1 id="page-title">\u0130cmal</h1></div><div class="actions"><button id="refresh" class="quiet">Yenil\u0259</button><button id="review">T\u0259sdiq\u0259 g\xF6nd\u0259r</button></div></div><div id="mode" class="banner"></div><section id="view"></section></main></div></div>\n<dialog id="editor"><form id="edit-form"><div class="dialog-heading"><h2 id="edit-title"></h2><button type="button" id="close-editor" class="quiet" aria-label="P\u0259nc\u0259r\u0259ni ba\u011Fla">\xD7</button></div><div id="fields"></div><div id="current-media"></div><p id="form-error" class="error" role="alert"></p><div class="actions"><button type="button" id="cancel-editor" class="quiet">L\u0259\u011Fv et</button><button type="submit">Saxla</button></div></form></dialog>\n<dialog id="confirmation"><div class="dialog-heading"><h2>M\u0259lumat silinsin?</h2></div><p>Silin\u0259n m\u0259lumat Git tarix\xE7\u0259sind\u0259 saxlan\u0131l\u0131r. Bu \u0259m\u0259liyyat \xFC\xE7\xFCn t\u0259sdiq t\u0259l\u0259b olunur.</p><div class="actions"><button id="cancel-delete" class="quiet">L\u0259\u011Fv et</button><button id="confirm-delete" class="danger">Sil</button></div></dialog>\n<dialog id="preview"><div class="dialog-heading"><h2>M\u0259zmun \xF6n bax\u0131\u015F\u0131</h2><button id="close-preview" class="quiet" aria-label="\xD6n bax\u0131\u015F\u0131 ba\u011Fla">\xD7</button></div><div id="preview-body"></div></dialog>\n</body></html>\n' }, "/admin.js": { "type": "text/javascript; charset=utf-8", "body": `const labels={dashboard:'\u0130cmal',news:'X\u0259b\u0259rl\u0259r',competitions:'Yar\u0131\u015Flar',protocols:'N\u0259tic\u0259l\u0259r v\u0259 protokollar',albums:'Foto qalereya',records:'Az\u0259rbaycan rekordlar\u0131',recordDocuments:'Rekord s\u0259n\u0259dl\u0259ri'};
const sports=['Pauerliftinq','Ben\xE7-press'];
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session,state,current='dashboard',editing=null,busy=false,pendingDelete=null,noticeTimer;
const searches={},filters={};
function notify(message){clearTimeout(noticeTimer);$('#notice').textContent=message;$('#notice').classList.add('visible');noticeTimer=setTimeout(()=>$('#notice').classList.remove('visible'),7000);}
function showLogin(){for(const d of document.querySelectorAll('dialog[open]'))d.close();$('#application').hidden=true;$('#login').hidden=false;state=null;}
async function api(path,options={}){
 const headers=new Headers(options.headers||{});
 if(options.method&&options.method!=='GET')headers.set('X-CSRF-Token',session?.csrf||'');
 if(options.body&&!(options.body instanceof FormData)){headers.set('Content-Type','application/json');options.body=JSON.stringify(options.body);}
 if(options.method&&options.method!=='GET'&&state)headers.set('If-Match',options.revision||state.revision);
 const response=await fetch('/api/'+path,{...options,headers,credentials:'same-origin'});
 const result=await response.json();if(!response.ok){if(response.status===401)showLogin();throw new Error(result.error||'Sor\u011Fu u\u011Fursuz oldu.');}return result;
}
async function run(operation){
 if(busy)return;busy=true;document.body.classList.add('busy');$('#application').setAttribute('aria-busy','true');
 const buttons=[...document.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 try{await operation();}catch(error){if($('#editor').open)$('#form-error').textContent=error.message;notify(error.message);}finally{busy=false;document.body.classList.remove('busy');$('#application').removeAttribute('aria-busy');buttons.forEach(b=>b.disabled=false);}
}
async function load(){state=await api('content');if(!state.local&&!state.renderingEnabled)$('#mode').textContent='M\u0259zmun saxlan\u0131l\u0131r, lakin canl\u0131 s\u0259hif\u0259l\u0259r \xFC\xE7\xFCn ixrac h\u0259l\u0259 aktiv deyil. D\u0259yi\u015Fiklikl\u0259r ayr\u0131ca t\u0259sdiql\u0259nm\u0259lidir.';render();}
async function loginState(){
 session=await api('session');$('#local-login').hidden=!session.local;$('#local-description').hidden=!session.local;
 if(!session.user){showLogin();return;}
 $('#login').hidden=true;$('#application').hidden=false;$('#user').textContent=session.user.login;
 $('#mode').textContent=session.local?'Yerli s\u0131naq rejimi: d\u0259yi\u015Fiklikl\u0259r yaln\u0131z bu komp\xFCterd\u0259 saxlan\u0131l\u0131r. Canl\u0131 sayt d\u0259yi\u015Fmir.':'D\u0259yi\u015Fiklikl\u0259r ayr\u0131ca t\u0259sdiql\u0259nm\u0259lidir. \u201CYay\u0131ma haz\u0131r\u201D m\u0259zmun canl\u0131 sayta avtomatik yerl\u0259\u015Fdirilmir.';
 await load();
}
function navigate(kind){current=kind;render();}
function render(){
 $('#navigation').innerHTML=Object.entries(labels).map(([key,label])=>\`<button data-nav="\${key}" class="\${current===key?'active':''}" \${current===key?'aria-current="page"':''}>\${label}</button>\`).join('');
 $('#navigation').querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.nav)));
 $('#page-title').textContent=labels[current];
 if(current==='dashboard'){
  $('#view').innerHTML=\`<div class="stats">\${Object.keys(labels).filter(k=>k!=='dashboard').map(k=>\`<button class="stat quiet" data-open="\${k}"><span><strong>\${state.collections[k].length}</strong>\${labels[k]}</span></button>\`).join('')}</div><div class="card"><h2>T\u0259hl\xFCk\u0259siz i\u015F qaydas\u0131</h2><p>M\u0259zmunu yarad\u0131n v\u0259 ya redakt\u0259 edin, \xF6n bax\u0131\u015F\u0131n\u0131 yoxlay\u0131n, sonra t\u0259sdiq\u0259 g\xF6nd\u0259rin. Canl\u0131 sayt ayr\u0131ca t\u0259sdiq olmadan d\u0259yi\u015Fmir.</p><p>M\xF6vcud 208 idman\xE7\u0131n\u0131n bazas\u0131 qorunur v\u0259 bu paneld\u0259n d\u0259yi\u015Fdirilmir.</p></div><div class="card"><h2>M\xF6vcud n\u0259tic\u0259l\u0259r</h2><p>Pauerliftinq v\u0259 Ben\xE7-press n\u0259tic\u0259l\u0259ri qorunur. Yeni r\u0259smi protokollar\u0131 m\xFCvafiq yar\u0131\u015Fa v\u0259 idman n\xF6v\xFCn\u0259 ba\u011Flay\u0131n.</p><a href="https://powerlifting.az/neticeler.html" target="_blank" rel="noopener noreferrer">Canl\u0131 n\u0259tic\u0259l\u0259r\u0259 bax</a></div>\`;
  $('#view').querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.open)));return;
 }
 $('#view').innerHTML=\`<div class="toolbar"><input id="search" type="search" placeholder="Axtar..." aria-label="\${escape(labels[current])} \xFCzr\u0259 axtar\u0131\u015F"><select id="filter" aria-label="M\u0259zmun filtri">\${current==='records'?'<option value="">B\xFCt\xFCn idman n\xF6vl\u0259ri</option>'+sports.map(x=>\`<option>\${x}</option>\`).join(''):'<option value="">B\xFCt\xFCn statuslar</option><option value="draft">Qaralama</option><option value="published">Yay\u0131ma haz\u0131r</option>'}</select><button id="new-item">\u018Flav\u0259 et</button></div><div class="list" id="list"></div>\`;
 $('#search').value=searches[current]||'';$('#filter').value=filters[current]||'';
 $('#new-item').addEventListener('click',()=>openEditor(null));$('#search').addEventListener('input',renderList);$('#filter').addEventListener('change',renderList);renderList();
}
function title(item){return item.title||item.name||\`\${item.sport} \xB7 \${item.gender} \xB7 \${item.wc} \xB7 \${item.move}\`;}
function summary(item){if(current==='records')return \`\${item.athlete||'\u2014'} \xB7 \${item.record===''?'Rekord g\xF6zl\u0259nilir':item.record+' kq'} \xB7 \${item.status}\`;if(current==='albums')return \`\${item.photos.length} \u015F\u0259kil\`;return item.dateText||item.startDate||item.date||item.file?.name||item.sport||'';}
function renderList(){
 searches[current]=$('#search').value;filters[current]=$('#filter').value;
 const query=$('#search').value.toLocaleLowerCase('az'),filter=$('#filter').value;
 const items=state.collections[current].filter(x=>JSON.stringify(x).toLocaleLowerCase('az').includes(query)&&(!filter||(current==='records'?x.sport:x.status)===filter));
 $('#list').innerHTML=items.length?items.map(item=>\`<article class="row" data-id="\${escape(item.id)}"><div><h3>\${escape(title(item))}</h3><p>\${escape(summary(item))}</p>\${current!=='records'?\`<span class="badge">\${item.status==='published'?'Yay\u0131ma haz\u0131r':'Qaralama'}</span>\`:''}</div><div class="row-actions"><button class="quiet" data-action="preview">\xD6n bax\u0131\u015F</button><button data-action="edit">Redakt\u0259 et</button>\${current!=='records'?\`<button class="quiet" data-action="publish">\${item.status==='published'?'Yay\u0131m\u0131 dayand\u0131r':'Yay\u0131ma haz\u0131rla\u015Fd\u0131r'}</button>\`:''}\${current!=='records'?'<button class="quiet" data-action="delete">Sil</button>':''}</div></article>\`).join(''):'<div class="empty">Bu se\xE7im \xFCzr\u0259 m\u0259lumat yoxdur.</div>';
 $('#list').querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{
  const item=state.collections[current].find(x=>x.id===button.closest('[data-id]').dataset.id);
  if(button.dataset.action==='edit')openEditor(item);
  if(button.dataset.action==='preview')preview(item);
  if(button.dataset.action==='delete')confirmDelete(async()=>{await api(\`content/\${current}/\${item.id}\`,{method:'DELETE'});await load();notify('M\u0259lumat silindi.');});
  if(button.dataset.action==='publish')run(async()=>{await api(\`content/\${current}/\${item.id}\`,{method:'PATCH',body:{status:item.status==='published'?'draft':'published'}});await load();notify('Yay\u0131m statusu saxlan\u0131ld\u0131. Canl\u0131 sayt avtomatik d\u0259yi\u015Fmir.');});
 }));
}
const configs={
 news:[['title','Ba\u015Fl\u0131q','text',true],['summary','Q\u0131sa m\u0259zmun','textarea'],['body','X\u0259b\u0259rin m\u0259tni','textarea',true],['date','Tarix (m\u0259lumdursa)','date'],['dateText','Tarixin g\xF6r\xFCn\u0259n yaz\u0131s\u0131','text'],['eventName','\u018Flaq\u0259li yar\u0131\u015F\u0131n ad\u0131','text'],['eventDate','Yar\u0131\u015F\u0131n tarixi','text'],['eventVenue','Yar\u0131\u015F\u0131n m\u0259kan\u0131','text']],
 competitions:[['name','Yar\u0131\u015F\u0131n ad\u0131','text',true],['startDate','Ba\u015Flama tarixi','date',true],['endDate','Bitm\u0259 tarixi','date',true],['dateText','Tarixin g\xF6r\xFCn\u0259n yaz\u0131s\u0131 (ist\u0259y\u0259 ba\u011Fl\u0131)','text'],['venue','M\u0259kan','text'],['description','T\u0259svir','textarea'],['sports','\u0130dman n\xF6vl\u0259ri','sports'],['badge','Yar\u0131\u015F\u0131n g\xF6r\xFCn\u0259n status yaz\u0131s\u0131','text']],
 protocols:[['title','Protokolun ad\u0131','text',true],['competitionId','Yar\u0131\u015F','competition',true],['sport','\u0130dman n\xF6v\xFC','sport',true],['description','T\u0259svir','textarea']],
 albums:[['title','Albomun ad\u0131','text',true],['competitionId','Yar\u0131\u015F (ist\u0259y\u0259 ba\u011Fl\u0131)','competition'],['description','T\u0259svir','textarea']],
 records:[['sport','\u0130dman n\xF6v\xFC','sport',true],['gender','Cins','gender',true],['wc','\xC7\u0259ki d\u0259r\u0259c\u0259si','text',true],['move','H\u0259r\u0259k\u0259t','move',true],['standard','Standart (kq)','number',true],['athlete','\u0130dman\xE7\u0131','text'],['record','Rekord (kq)','number'],['event','Yar\u0131\u015F','text'],['status','Rekord statusu','recordStatus',true]],
 recordDocuments:[['title','S\u0259n\u0259din ad\u0131','text',true],['description','T\u0259svir','textarea']]
};
function field([name,label,type,required],item){
 const value=item?.[name]??'';let control;
 if(type==='textarea')control=\`<textarea name="\${name}" \${required?'required':''} maxlength="\${name==='body'?40000:4000}">\${escape(value)}</textarea>\`;
 else if(type==='sports')control=\`<div class="checkboxes">\${sports.map(s=>\`<label><input type="checkbox" name="sports" value="\${s}" \${item?.sports?.includes(s)?'checked':''}>\${s}</label>\`).join('')}</div>\`;
 else if(['competition','sport','gender','move','recordStatus'].includes(type)){
  const choices=type==='competition'?state.collections.competitions.map(x=>[x.id,x.name]):(type==='sport'?sports:type==='gender'?['Ki\u015Fil\u0259r','Qad\u0131nlar']:type==='move'?['Squat','Ben\xE7-press','Deadlift','Total']:['G\xF6zl\u0259nilir','M\xFCv\u0259qq\u0259ti Rekord','R\u0259smi Rekord']).map(x=>[x,x]);
  control=\`<select name="\${name}" \${required?'required':''}>\${type==='competition'?'<option value="">Se\xE7in</option>':''}\${choices.map(([key,label])=>\`<option value="\${escape(key)}" \${key===value?'selected':''}>\${escape(label)}</option>\`).join('')}</select>\`;
 }else control=\`<input name="\${name}" type="\${type}" value="\${escape(value)}" \${required?'required':''} \${type==='number'?'min="0" max="3000" step="0.01"':'maxlength="4000"'}>\`;
 const id=\`field-\${name}\`;
 control=control.replace(/^(<(?:input|textarea|select))/, \`$1 id="\${id}"\`);
 return \`<div class="\${type==='textarea'?'wide':''}"><label \${type!=='sports'?\`for="\${id}"\`:''}>\${label}</label>\${control}</div>\`;
}
function openEditor(item){
 editing={item:structuredClone(item),kind:current,revision:state.revision};$('#form-error').textContent='';$('#edit-title').textContent=item?'Redakt\u0259 et':'Yeni m\u0259lumat';
 $('#fields').innerHTML=\`<div class="field-grid">\${configs[current].map(f=>field(f,item)).join('')}</div>\${current!=='records'?\`<label>Yay\u0131m statusu<select name="status"><option value="draft" \${item?.status!=='published'?'selected':''}>Qaralama</option><option value="published" \${item?.status==='published'?'selected':''}>Yay\u0131ma haz\u0131r</option></select></label>\`:''}\${['news','competitions','albums','protocols','recordDocuments'].includes(current)?\`<label>\${current==='albums'?'\u015E\u0259kill\u0259r (bir d\u0259f\u0259y\u0259 \u0259n \xE7ox 20)':['news','competitions'].includes(current)?'\u015E\u0259kil':'S\u0259n\u0259d'}<input name="files" type="file" \${current==='albums'?'multiple':''} accept="\${['news','competitions','albums'].includes(current)?'image/jpeg,image/png,image/webp':'.pdf,.xlsx,.xls,.csv,.docx'}"><small>\${['news','competitions','albums'].includes(current)?'\u015E\u0259kill\u0259r avtomatik ki\xE7ildilir v\u0259 veb \xFC\xE7\xFCn optimalla\u015Fd\u0131r\u0131l\u0131r.':'PDF, Excel, UTF-8 CSV v\u0259 Word; h\u0259r s\u0259n\u0259d \u0259n \xE7ox 10 MB.'}</small></label>\`:''}\`;
 renderMedia(item);$('#editor').showModal();
}
function assetUrl(path){return '/api/assets?path='+encodeURIComponent(path);}
function renderMedia(item){
 const kind=editing.kind;
 if(item?.photos){
  $('#current-media').innerHTML=\`<div class="media-grid">\${item.photos.map(photo=>\`<div class="media-card" data-photo="\${photo.id}"><img src="\${assetUrl(photo.path)}" alt="\${escape(photo.alt)}"><label>Alternativ m\u0259tn<input data-alt value="\${escape(photo.alt)}" maxlength="1000"></label><label>\u015E\u0259klin izah\u0131<input data-caption value="\${escape(photo.caption)}" maxlength="1000"></label><button type="button" data-photo-save>Saxla</button><button type="button" class="quiet" data-photo-delete>\u015E\u0259kli sil</button></div>\`).join('')}</div>\`;
  $('#current-media').querySelectorAll('[data-photo-save]').forEach(button=>button.addEventListener('click',()=>run(async()=>{
   const card=button.closest('[data-photo]');const result=await api(\`content/albums/\${item.id}/photos/\${card.dataset.photo}\`,{method:'PATCH',body:{alt:card.querySelector('[data-alt]').value,caption:card.querySelector('[data-caption]').value},revision:editing.revision});editing.revision=result.revision;await load();renderMedia(state.collections.albums.find(x=>x.id===item.id));notify('\u015E\u0259kil m\u0259lumat\u0131 saxlan\u0131ld\u0131.');
  })));
  $('#current-media').querySelectorAll('[data-photo-delete]').forEach(button=>button.addEventListener('click',()=>confirmDelete(async()=>{
   const result=await api(\`content/albums/\${item.id}/photos/\${button.closest('[data-photo]').dataset.photo}\`,{method:'DELETE',revision:editing.revision});editing.revision=result.revision;await load();renderMedia(state.collections.albums.find(x=>x.id===item.id));notify('\u015E\u0259kil silindi.');
  })));
 }else if(item?.image)$('#current-media').innerHTML=\`<p class="help">M\xF6vcud \u015F\u0259kil yeni fayl y\xFCkl\u0259ndikd\u0259 \u0259v\u0259zl\u0259nir.</p><img src="\${assetUrl(item.image)}" alt="M\xF6vcud \u015F\u0259kil" width="160">\`;
 else if(item?.file)$('#current-media').innerHTML=\`<p>M\xF6vcud s\u0259n\u0259d: <a href="\${assetUrl(item.file.path)}" target="_blank" rel="noopener noreferrer">\${escape(item.file.name)}</a></p>\`;
 else $('#current-media').textContent='';
}
async function optimize(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)throw new Error('JPEG, PNG v\u0259 ya WebP \u015F\u0259kli se\xE7in (\u0259n \xE7ox 12 MB).');
 const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>25000000){bitmap.close();throw new Error('\u015E\u0259klin \xF6l\xE7\xFCs\xFC \xE7ox b\xF6y\xFCkd\xFCr (\u0259n \xE7ox 25 milyon piksel).');}
 const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.82));if(!blob||blob.type!=='image/webp')throw new Error('Bu brauzer WebP optimalla\u015Fd\u0131rmas\u0131n\u0131 d\u0259st\u0259kl\u0259mir.');
 return new File([blob],file.name.replace(/\\.[^.]+$/,'')+'.webp',{type:'image/webp'});
}
$('#edit-form').addEventListener('submit',event=>{
 event.preventDefault();run(async()=>{
  $('#form-error').textContent='';const form=new FormData(event.currentTarget),kind=editing.kind,body={};
  for(const [name,,type] of configs[kind])body[name]=type==='sports'?form.getAll(name):type==='number'?(form.get(name)===''?'':Number(form.get(name))):String(form.get(name)||'');
  if(kind!=='records')body.status=String(form.get('status'));
  if(kind==='competitions'&&editing.item&&(body.startDate!==editing.item.startDate||body.endDate!==editing.item.endDate)&&body.dateText===editing.item.dateText)body.dateText='';
  const files=form.getAll('files').filter(f=>f.size);if(files.length>20)throw new Error('Bir d\u0259f\u0259y\u0259 \u0259n \xE7ox 20 \u015F\u0259kil se\xE7in.');
  const prepared=[];for(const file of files){notify('Fayllar haz\u0131rlan\u0131r...');prepared.push(['news','competitions','albums'].includes(kind)?await optimize(file):file);}
  // Document records are initially drafts until a verified attachment exists.
  const requestedStatus=body.status;
  if(['protocols','recordDocuments'].includes(kind)&&prepared.length)body.status='draft';
  const result=await api('content/'+kind+(editing.item?'/'+editing.item.id:''),{method:editing.item?'PATCH':'POST',body,revision:editing.revision});
  editing.item=result.item;editing.revision=result.revision;state.revision=result.revision;
  if(prepared.length){
   const uploads=new FormData();uploads.set('kind',kind);uploads.set('id',result.item.id);for(const file of prepared)uploads.append('files',file);
   let uploaded;
   try{notify('Fayllar y\xFCkl\u0259nir...');uploaded=await api('uploads',{method:'POST',body:uploads,revision:result.revision});}catch(error){await load();renderMedia(state.collections[kind].find(x=>x.id===result.item.id));throw new Error('M\u0259tn saxlan\u0131ld\u0131, lakin fayl y\xFCkl\u0259nm\u0259di: '+error.message);}
   editing.revision=uploaded.revision;state.revision=uploaded.revision;
   if(['protocols','recordDocuments'].includes(kind)&&requestedStatus==='published')await api(\`content/\${kind}/\${result.item.id}\`,{method:'PATCH',body:{status:requestedStatus},revision:uploaded.revision});
  }
  $('#editor').close();editing=null;await load();notify('Saxlan\u0131ld\u0131. D\u0259yi\u015Fiklikl\u0259r t\u0259sdiqd\u0259n sonra yay\u0131na veril\u0259 bil\u0259r.');
 });
});
function confirmDelete(operation){pendingDelete=operation;$('#confirmation').showModal();}
$('#confirm-delete').addEventListener('click',()=>run(async()=>{const action=pendingDelete;$('#confirmation').close();pendingDelete=null;await action();}));
$('#cancel-delete').addEventListener('click',()=>{$('#confirmation').close();pendingDelete=null;});
for(const id of ['close-editor','cancel-editor'])$('#'+id).addEventListener('click',()=>{$('#editor').close();editing=null;});
function preview(item){
 const body=$('#preview-body');body.replaceChildren();
 const heading=document.createElement('h3');heading.textContent=title(item);body.append(heading);
 const detail=document.createElement('p');detail.textContent=item.body||item.description||summary(item);body.append(detail);
 for(const path of [item.image,...(item.photos||[]).map(x=>x.path)].filter(Boolean)){const img=document.createElement('img');img.src=assetUrl(path);img.alt=item.title||item.name||'';body.append(img);}
 if(item.file){const a=document.createElement('a');a.href=assetUrl(item.file.path);a.textContent=item.file.name;a.target='_blank';a.rel='noopener noreferrer';body.append(a);}
 $('#preview').showModal();
}
$('#close-preview').addEventListener('click',()=>$('#preview').close());
$('#local-login').addEventListener('click',()=>run(async()=>{await api('auth/local',{method:'POST'});await loginState();}));
$('#logout').addEventListener('click',()=>run(async()=>{await api('auth/logout',{method:'POST'});session=null;showLogin();}));
$('#refresh').addEventListener('click',()=>run(async()=>{await load();notify('M\u0259lumat yenil\u0259ndi.');}));
$('#review').addEventListener('click',()=>run(async()=>{
 const result=await api('review',{method:'POST'});
 if(!result.url){notify(session.local?'Yerli s\u0131naqda GitHub t\u0259sdiq sor\u011Fusu yarad\u0131lm\u0131r.':'\u018Fvv\u0259lc\u0259 m\u0259zmun d\u0259yi\u015Fikliyi saxlay\u0131n.');return;}
 const url=new URL(result.url);if(url.origin!=='https://github.com')throw new Error('T\u0259sdiq \xFCnvan\u0131 etibars\u0131zd\u0131r.');
 const box=$('#mode');box.textContent='D\u0259yi\u015Fiklikl\u0259r t\u0259sdiq\u0259 g\xF6nd\u0259rildi: ';const link=document.createElement('a');link.href=url.href;link.textContent='T\u0259sdiq sor\u011Fusuna bax';link.target='_blank';link.rel='noopener noreferrer';link.className='review-link';box.append(link);
}));
run(loginState);
` }, "/admin.css": { "type": "text/css; charset=utf-8", "body": ':root{--navy:#031b2b;--blue:#0788ef;--gold:#f0bc3d;--line:#dbe4ea;--muted:#61717d;--light:#f5f7f9;--danger:#9d2333}*{box-sizing:border-box}body{margin:0;color:#0b1b28;background:var(--light);font:16px/1.6 "Segoe UI",Arial,sans-serif}[hidden]{display:none!important}button,.button{border:0;border-radius:8px;background:var(--blue);color:white;padding:11px 18px;min-height:44px;font:inherit;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px}button:disabled{opacity:.6;cursor:wait}.quiet{background:white;color:var(--navy);border:1px solid var(--line)}.danger{background:var(--danger)}button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid var(--gold);outline-offset:3px}header{background:var(--navy);color:white;padding:22px 30px;display:flex;align-items:center;justify-content:space-between;gap:16px}header strong,header span{display:block}header span{font-size:13px;color:#dbe4ea}.account{display:flex;align-items:center;gap:14px}.shell{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:calc(100vh - 105px)}nav{padding:24px 16px;background:#06283d;color:white}nav button{width:100%;text-align:left;justify-content:flex-start;background:none;margin-bottom:6px}nav button.active{background:var(--blue)}#workspace{padding:30px;min-width:0}.workspace-top,.dialog-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.workspace-top h1{margin:0 0 18px;font-size:30px}.eyebrow{font-size:11px;letter-spacing:1.5px;font-weight:800;color:var(--muted);margin:0 0 8px}.actions{display:flex;gap:10px;flex-wrap:wrap}.banner{padding:16px 18px;border:1px solid var(--line);border-left:4px solid var(--blue);border-radius:8px;background:white;margin:16px 0 24px;font-size:14px}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.stat,.card{background:white;border:1px solid var(--line);border-radius:12px;padding:20px;box-shadow:0 6px 22px #031b2b08}.stat strong{display:block;font-size:32px;color:var(--navy)}.toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:24px 0 16px}.toolbar input{flex:1;min-width:160px}.list{display:grid;gap:12px}.row{background:white;padding:18px;border:1px solid var(--line);border-radius:10px;display:flex;justify-content:space-between;align-items:center;gap:16px}.row h3{margin:0;font-size:18px;overflow-wrap:anywhere}.row p{margin:4px 0;color:var(--muted);font-size:14px}.badge{font-size:12px;font-weight:800;padding:5px 8px;background:#eef6fb;color:var(--navy);border-radius:5px}.row-actions{display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0}.row-actions button{padding:9px 12px;font-size:13px}input,textarea,select{display:block;width:100%;min-height:46px;border:1px solid #b9c9d3;border-radius:7px;padding:10px 12px;font:inherit;background:white;color:var(--navy)}textarea{min-height:140px;resize:vertical}label{display:block;font-weight:700;margin:16px 0 6px}label small,.help{display:block;font-size:13px;font-weight:400;color:var(--muted);margin-top:5px}.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}.field-grid .wide{grid-column:1/-1}.checkboxes{display:flex;gap:20px;flex-wrap:wrap}.checkboxes label{display:flex;align-items:center;gap:8px}.checkboxes input{width:20px;min-height:20px}.error{color:var(--danger);font-weight:600}.empty{text-align:center;padding:40px;background:white;border:1px dashed #b9c9d3;border-radius:10px;color:var(--muted)}dialog{border:1px solid var(--line);border-radius:14px;padding:24px;width:min(720px,calc(100% - 24px));max-height:90dvh;overflow:auto;color:var(--navy)}dialog::backdrop{background:#031b2baa}dialog h2{margin:0;font-size:24px}dialog .actions{margin-top:24px;justify-content:flex-end}#preview-body{white-space:pre-wrap;overflow-wrap:anywhere}#preview-body img{max-width:100%;max-height:320px;object-fit:contain}.media-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px}.media-card{border:1px solid var(--line);padding:10px;border-radius:8px}.media-card img{width:100%;height:130px;object-fit:cover}.media-card input{margin:8px 0;font-size:13px}.media-card button{width:100%;margin:4px 0}.login{min-height:100vh;display:grid;place-items:center;padding:20px;background:linear-gradient(135deg,#031b2b,#06283d)}.login-card{background:white;padding:40px;border-radius:16px;width:min(480px,100%)}.login-card h1{font-size:30px}.login-card .button,.login-card button{width:100%;margin:12px 0 0}.brand-mark{background:var(--navy);color:white;border-bottom:4px solid var(--gold);border-radius:10px;display:inline-block;padding:10px 15px;font-size:24px;font-weight:900;margin-bottom:18px}#notice{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);max-width:calc(100% - 32px);padding:12px 18px;background:var(--navy);color:white;border-radius:8px;z-index:1000;display:none}#notice.visible{display:block}.busy{cursor:wait}a{color:#087fdc}h2{line-height:1.35}.review-link{overflow-wrap:anywhere}.card h2{margin:0 0 12px}.card+.card{margin-top:16px}\n@media(max-width:850px){header{padding:18px;align-items:flex-start}header strong{font-size:15px}.account{flex-direction:column;gap:8px;align-items:flex-end}.shell{grid-template-columns:1fr}nav{padding:10px;display:flex;overflow-x:auto;gap:6px}nav button{width:auto;white-space:nowrap;margin:0;flex:0 0 auto}#workspace{padding:20px 16px}.workspace-top{align-items:flex-start;flex-direction:column}.workspace-top h1{font-size:27px;margin-bottom:0}.stats{grid-template-columns:1fr 1fr}.row{align-items:flex-start;flex-direction:column}.row-actions{width:100%;flex-wrap:wrap}.field-grid{grid-template-columns:1fr}.media-grid{grid-template-columns:1fr 1fr}.login-card{padding:28px}dialog{padding:20px}.toolbar input{min-width:0;width:100%}.toolbar button{flex:1}.account span{max-width:150px;overflow-wrap:anywhere}}\n@media(max-width:360px){.stats,.media-grid{grid-template-columns:1fr}.row-actions button{flex:1}.login-card{padding:22px}.workspace-top .actions{width:100%}}\n' } };
var BROWSER_BUILD = "sha256:0ea6e92ae7a6179e";

// scripts/browser-worker-entry.mjs
var ORIGIN = "https://powerlifting-admin-v2-staging.powerlifting-aze-482.workers.dev";
var browser_worker_entry_default = { async fetch(request, bindings) {
  if (new URL(request.url).pathname === "/api/health") return Response.json({ service: "powerlifting-v2-staging", build: BROWSER_BUILD }, { headers: securityHeaders() });
  const env = { ...bindings, PUBLIC_ORIGIN: ORIGIN, ADMIN_USER_IDS: "335450583", STAGING_ONLY: "true", GITHUB_REPOSITORY: "HafizV1/powerlifting-v1-preview", BASE_BRANCH: "v2/staging-base", DATA_BRANCH: "v2/content-staging", ENABLE_V1_EXPORT: "false" };
  if (!env.SESSION_SECRET && env.GITHUB_CLIENT_SECRET) {
    const bytes = new TextEncoder(), material = await crypto.subtle.importKey("raw", bytes.encode(env.GITHUB_CLIENT_SECRET), "HKDF", false, ["deriveBits"]);
    const key2 = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: bytes.encode(ORIGIN), info: bytes.encode("powerlifting-v2-staging/session-signing/v1") }, material, 384);
    env.SESSION_SECRET = Array.from(new Uint8Array(key2), (x) => x.toString(16).padStart(2, "0")).join("");
  }
  env.ASSETS = { async fetch(req) {
    const path = new URL(req.url).pathname, asset = BROWSER_ASSETS[path === "/" ? "/index.html" : path];
    if (!asset) return new Response("Not found", { status: 404 });
    if (!["GET", "HEAD"].includes(req.method)) return new Response("Method not allowed", { status: 405 });
    return new Response(req.method === "HEAD" ? null : asset.body, { headers: { "Content-Type": asset.type } });
  } };
  const result = await worker_default.fetch(request, env);
  const response = new Response(result.body, result);
  response.headers.set("X-Admin-Build", BROWSER_BUILD);
  return response;
} };
export {
  browser_worker_entry_default as default
};

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const SEED = path.join(ROOT, "data", "posts.json");
const LOCAL_DB = process.env.DB_PATH || path.join("/tmp", "feed-posts.json");
const MONGO_URI = process.env.MONGODB_URI || "";
const MONGO_DB = process.env.MONGODB_DB || "feed";
const MONGO_COL = process.env.MONGODB_COLLECTION || "posts";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function seedPosts() {
  try { return JSON.parse(fs.readFileSync(SEED, "utf8")); } catch { return []; }
}

let colPromise = null;
async function collection() {
  if (!MONGO_URI) return null;
  if (!colPromise) {
    colPromise = (async () => {
      const { MongoClient } = require("mongodb");
      const client = new MongoClient(MONGO_URI);
      await client.connect();
      const col = client.db(MONGO_DB).collection(MONGO_COL);
      if ((await col.countDocuments()) === 0) {
        const seed = seedPosts();
        if (seed.length) await col.insertMany(seed);
      }
      return col;
    })();
  }
  return colPromise;
}

function publicPost(doc) {
  return {
    id: doc.id, user: doc.user || "vos", text: doc.text || "",
    likes: Number(doc.likes || 0), liked: Boolean(doc.liked),
    comments: Array.isArray(doc.comments) ? doc.comments : [],
  };
}
function localRead() {
  try { if (fs.existsSync(LOCAL_DB)) return JSON.parse(fs.readFileSync(LOCAL_DB, "utf8")); } catch {}
  const seed = seedPosts(); localWrite(seed); return seed;
}
function localWrite(rows) { fs.writeFileSync(LOCAL_DB, JSON.stringify(rows, null, 2)); }
function send(res, status, body, type = TYPES[".json"]) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function body(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
  });
}
function file(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "No encontrado", "text/plain; charset=utf-8");
    send(res, 200, data, TYPES[path.extname(filePath)] || "application/octet-stream");
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const col = await collection();
    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/healthz")) {
      return send(res, 200, { ok: true, store: col ? "mongodb" : "local" });
    }
    if (req.method === "GET" && url.pathname === "/api/posts") {
      const rows = col ? (await col.find({}, { projection: { _id: 0 } }).toArray()).map(publicPost) : localRead();
      rows.sort((a, b) => String(b.id).localeCompare(String(a.id)));
      return send(res, 200, rows);
    }
    if (req.method === "POST" && url.pathname === "/api/posts") {
      const text = String((await body(req)).text || "").trim().slice(0, 280);
      if (!text) return send(res, 400, { error: "vacio" });
      const post = { id: "p" + Date.now(), user: "vos", text, likes: 0, liked: false, comments: [] };
      if (col) await col.insertOne({ ...post });
      else { const rows = localRead(); rows.unshift(post); localWrite(rows); }
      return send(res, 201, post);
    }
    const like = url.pathname.match(/^\/api\/posts\/([^/]+)\/like$/);
    if (req.method === "POST" && like) {
      const id = like[1];
      if (col) {
        const post = await col.findOne({ id });
        if (!post) return send(res, 404, { error: "no" });
        const liked = !post.liked;
        const likes = Number(post.likes || 0) + (liked ? 1 : -1);
        await col.updateOne({ id }, { $set: { liked, likes } });
        return send(res, 200, publicPost({ ...post, liked, likes }));
      }
      const rows = localRead();
      const post = rows.find((p) => p.id === id);
      if (!post) return send(res, 404, { error: "no" });
      post.liked = !post.liked; post.likes += post.liked ? 1 : -1; localWrite(rows);
      return send(res, 200, post);
    }
    const comment = url.pathname.match(/^\/api\/posts\/([^/]+)\/comments$/);
    if (req.method === "POST" && comment) {
      const id = comment[1];
      const text = String((await body(req)).text || "").trim().slice(0, 140);
      if (!text) return send(res, 400, { error: "vacio" });
      if (col) {
        const post = await col.findOne({ id });
        if (!post) return send(res, 404, { error: "no" });
        const comments = [...(post.comments || []), text];
        await col.updateOne({ id }, { $set: { comments } });
        return send(res, 201, publicPost({ ...post, comments }));
      }
      const rows = localRead();
      const post = rows.find((p) => p.id === id);
      if (!post) return send(res, 404, { error: "no" });
      post.comments = post.comments || []; post.comments.push(text); localWrite(rows);
      return send(res, 201, post);
    }
    const rel = url.pathname === "/" ? "/index.html" : url.pathname;
    const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, "");
    file(res, path.join(PUBLIC, safe));
  } catch (err) {
    console.error(err);
    send(res, 500, { error: "store", detail: String(err.message || err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`listening on http://${HOST}:${PORT} store=${MONGO_URI ? "mongodb" : "local"}`);
});

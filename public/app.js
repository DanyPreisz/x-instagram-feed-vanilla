const feed = document.querySelector("#feed");
const form = document.querySelector("#compose");
const text = document.querySelector("#text");
const storeEl = document.querySelector("#store");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.value }) });
  text.value = "";
  load();
});
feed.addEventListener("click", async (event) => {
  const like = event.target.closest("[data-like]");
  if (!like) return;
  await fetch("/api/posts/" + like.dataset.like + "/like", { method: "POST" });
  load();
});
feed.addEventListener("submit", async (event) => {
  const box = event.target.closest("[data-comment]");
  if (!box) return;
  event.preventDefault();
  await fetch("/api/posts/" + box.dataset.comment + "/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: box.querySelector("input").value }),
  });
  load();
});
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&" + "amp;").replace(/</g, "<" + "lt;");
}
async function load() {
  const posts = await (await fetch("/api/posts")).json();
  feed.innerHTML = posts.map((p) => `<article>
    <p class="meta">@${escapeHtml(p.user)}</p>
    <p>${escapeHtml(p.text)}</p>
    <div class="row"><button type="button" class="like ${p.liked ? "is-on" : ""}" data-like="${p.id}">♥ ${p.likes}</button></div>
    <div class="comments">${(p.comments || []).map((c) => `<p>· ${escapeHtml(c)}</p>`).join("")}</div>
    <form data-comment="${p.id}"><input placeholder="Comentar" required /></form>
  </article>`).join("");
}
async function boot() {
  const health = await (await fetch("/health")).json();
  storeEl.textContent = health.store === "mongodb" ? "MongoDB" : "Local";
  load();
}
boot();

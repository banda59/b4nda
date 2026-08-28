(async () => {
  const q = new URLSearchParams(location.search);
  const tag = q.get("tag");

  const r = await fetch("./posts.json");
  const d = await r.json();

  const el = document.querySelector(".post-list");
  if (!el) return;

  const ps = (d.posts || [])
    .filter(p => !tag || (p.tags || []).includes(tag))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  el.innerHTML = ps.map(p => {
    const ts = (p.tags || []).map(t => `<a href="./index.html?tag=${encodeURIComponent(t)}">${t}</a>`).join(", ");
    return `
      <article class="post-item">
        <header class="post-header">
          <h3 class="post-title"><a href="./posts/${p.slug}.html">${p.title}</a></h3>
          <p class="post-meta">
            <time datetime="${p.date}">${p.date_human}</time> |
            <span class="post-tags">${ts}</span>
          </p>
        </header>
        <div class="post-excerpt"><p>${p.excerpt || ""}</p></div>
        <a href="./posts/${p.slug}.html" class="read-more">Read More &rarr;</a>
      </article>
    `;
  }).join("");
})();

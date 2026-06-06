(async () => {
  const postList = document.getElementById("postList");
  if (!postList) return;

  const response = await fetch("./posts.json", { cache: "no-store" });
  if (!response.ok) {
    postList.innerHTML = '<p class="bl-empty">Failed to load posts.</p>';
    return;
  }

  const data = await response.json();
  const posts = (data.posts || []).sort((a, b) => (a.date < b.date ? 1 : -1));

  if (posts.length === 0) {
    postList.innerHTML = '<p class="bl-empty">No posts yet.</p>';
    return;
  }

  const monthDay = (date) => {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return date || "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  };

  const yearOf = (date) => {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return String(date || "").slice(0, 4) || "Posts";
    return String(d.getUTCFullYear());
  };

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  const groups = posts.reduce((acc, post) => {
    const year = yearOf(post.date);
    if (!acc.has(year)) acc.set(year, []);
    acc.get(year).push(post);
    return acc;
  }, new Map());

  postList.innerHTML = [...groups.entries()].map(([year, items]) => `
    <section class="bl-year-group">
      <div class="bl-year">
        <span class="bl-year-num">${escapeHtml(year)}</span>
        <span class="bl-year-count">${items.length} ${items.length === 1 ? "post" : "posts"}</span>
        <span class="bl-year-line"></span>
      </div>
      <div class="bl-posts">
        ${items.map((post) => {
          const href = post.externalUrl || `./posts/${encodeURIComponent(post.slug)}.html`;
          const tags = (post.tags || []).map(tag => `<span class="bl-tag">${escapeHtml(tag)}</span>`).join("");
          const thumb = post.previewImage
            ? `<img src="${escapeHtml(post.previewImage)}" alt="" class="bl-thumb-img" loading="lazy">`
            : `<span>${escapeHtml((post.tags || [post.title])[0])}</span>`;

          return `
            <a class="bl-card" href="${escapeHtml(href)}" aria-label="${escapeHtml(post.title)}">
              <div class="bl-body">
                <div class="bl-meta">
                  <span class="bl-date">${escapeHtml(monthDay(post.date))}</span>
                </div>
                <h2>${escapeHtml(post.title)}</h2>
                <div class="bl-tags">${tags}</div>
                <span class="bl-readmore">Read More -></span>
              </div>
              <div class="bl-thumb">${thumb}</div>
            </a>
          `;
        }).join("")}
      </div>
    </section>
  `).join("");

  document.querySelectorAll(".bl-card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    });
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  if (reduceMotion || !finePointer) return;

  const canvas = document.getElementById("bl-trail");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;

  const resize = () => {
    width = canvas.width = innerWidth * dpr;
    height = canvas.height = innerHeight * dpr;
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
  };

  resize();
  addEventListener("resize", resize);

  const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
  let active = false;
  addEventListener("pointermove", (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    active = true;
  });
  addEventListener("pointerleave", () => { active = false; });

  const points = Array.from({ length: 44 }, () => ({ x: mouse.x, y: mouse.y }));

  const frame = () => {
    points[0].x += (mouse.x - points[0].x) * 0.42;
    points[0].y += (mouse.y - points[0].y) * 0.42;
    for (let i = 1; i < points.length; i += 1) {
      points[i].x += (points[i - 1].x - points[i].x) * 0.42;
      points[i].y += (points[i - 1].y - points[i].y) * 0.42;
    }

    ctx.clearRect(0, 0, width, height);
    if (active) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(255,255,255,0.35)";
      for (let i = 1; i < points.length; i += 1) {
        const p0 = points[i - 1];
        const p1 = points[i];
        const frac = 1 - i / points.length;
        ctx.strokeStyle = `rgba(255,255,255,${frac * 0.2})`;
        ctx.lineWidth = frac * 2 * dpr;
        ctx.shadowBlur = 4 * dpr * frac;
        ctx.beginPath();
        ctx.moveTo(p0.x * dpr, p0.y * dpr);
        ctx.lineTo(p1.x * dpr, p1.y * dpr);
        ctx.stroke();
      }
    }
    requestAnimationFrame(frame);
  };

  frame();
})();

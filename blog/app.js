(async () => {
  const postList = document.getElementById("postList");
  if (!postList) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Starfield background ---------- */
  (() => {
    const canvas = document.getElementById("bl-stars");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let stars = [];

    const build = () => {
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      const count = Math.min(240, Math.floor((innerWidth * innerHeight) / 9000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * innerWidth,
        y: Math.random() * innerHeight,
        s: Math.random() < 0.85 ? 1 : 2,
        base: 0.12 + Math.random() * 0.4,
        sp: 0.4 + Math.random() * 1.1,
        ph: Math.random() * Math.PI * 2
      }));
    };

    const draw = (t) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.fillStyle = "#fff";
      for (const st of stars) {
        const a = reduceMotion ? st.base : Math.max(0, st.base + 0.3 * Math.sin(t * st.sp + st.ph));
        if (a <= 0.02) continue;
        ctx.globalAlpha = Math.min(0.75, a);
        ctx.fillRect(st.x | 0, st.y | 0, st.s, st.s);
      }
      ctx.globalAlpha = 1;
    };

    build();
    addEventListener("resize", build);

    if (reduceMotion) {
      draw(0);
      addEventListener("resize", () => draw(0));
      return;
    }

    /* shooting stars */
    let meteor = null;
    let nextMeteorAt = 2.5 + Math.random() * 5;
    let lastT = 0;

    const spawnMeteor = () => {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const ang = (32 + Math.random() * 22) * Math.PI / 180;
      const speed = 480 + Math.random() * 400;
      return {
        x: Math.random() * innerWidth,
        y: -20 + Math.random() * innerHeight * 0.35,
        vx: Math.cos(ang) * speed * dir,
        vy: Math.sin(ang) * speed,
        life: 1,
        decay: 1 / (0.7 + Math.random() * 0.6),
        len: 90 + Math.random() * 90
      };
    };

    const drawMeteor = (m) => {
      const a = Math.sin(Math.PI * (1 - m.life)) * 0.75;
      const norm = Math.hypot(m.vx, m.vy);
      const tx = m.x - (m.vx / norm) * m.len;
      const ty = m.y - (m.vy / norm) * m.len;
      const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
      grad.addColorStop(0, `rgba(255,255,255,${a})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, a * 1.35)})`;
      ctx.fillRect(m.x - 1, m.y - 1, 2.5, 2.5);
    };

    const loop = (now) => {
      const t = now / 1000;
      const dt = Math.min(0.05, lastT ? t - lastT : 0.016);
      lastT = t;
      draw(t);

      if (!meteor && t >= nextMeteorAt) meteor = spawnMeteor();
      if (meteor) {
        meteor.x += meteor.vx * dt;
        meteor.y += meteor.vy * dt;
        meteor.life -= meteor.decay * dt;
        if (meteor.life <= 0 || meteor.y > innerHeight + 60 ||
            meteor.x < -120 || meteor.x > innerWidth + 120) {
          meteor = null;
          nextMeteorAt = t + 4 + Math.random() * 9;
        } else {
          drawMeteor(meteor);
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  })();

  /* ---------- Terminal typing header ---------- */
  (() => {
    const term = document.getElementById("blTerm");
    if (!term) return;
    const phrases = [
      "ls -la ./posts",
      "tail -f space.log",
      "git log --oneline",
      "ping andromeda.local"
    ];
    if (reduceMotion) {
      term.textContent = phrases[0];
      return;
    }
    let pi = 0;
    let ci = 0;
    let deleting = false;
    const tick = () => {
      const phrase = phrases[pi];
      term.textContent = phrase.slice(0, ci);
      let delay;
      if (!deleting) {
        ci += 1;
        delay = 42 + Math.random() * 46;
        if (ci > phrase.length) { deleting = true; delay = 2400; }
      } else {
        ci -= 1;
        delay = 18;
        if (ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; delay = 500; }
      }
      setTimeout(tick, delay);
    };
    tick();
  })();

  /* ---------- Posts ---------- */
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

  // Chronological entry number: oldest post = LOG_01
  posts.forEach((post, i) => { post._num = posts.length - i; });

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

  const hostOf = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  };

  /* Sidebar stats */
  const allTags = new Map();
  posts.forEach((post) => (post.tags || []).forEach((tag) => {
    allTags.set(tag, (allTags.get(tag) || 0) + 1);
  }));
  const stats = document.getElementById("blStats");
  if (stats) {
    const years = posts.map((p) => yearOf(p.date)).filter((y) => /^\d{4}$/.test(y));
    const since = years.length ? Math.min(...years.map(Number)) : "";
    stats.textContent = `${posts.length} posts · ${allTags.size} tags${since ? ` · since ${since}` : ""}`;
  }

  /* Reveal-on-scroll */
  const observer = reduceMotion ? null : new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      card.classList.add("bl-in");
      setTimeout(() => { card.style.transitionDelay = ""; }, 700);
      observer.unobserve(card);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });

  const renderList = (items) => {
    if (items.length === 0) {
      postList.innerHTML = '<p class="bl-empty">No posts match this tag.</p>';
      return;
    }

    const groups = items.reduce((acc, post) => {
      const year = yearOf(post.date);
      if (!acc.has(year)) acc.set(year, []);
      acc.get(year).push(post);
      return acc;
    }, new Map());

    postList.innerHTML = [...groups.entries()].map(([year, group]) => `
      <section class="bl-year-group">
        <div class="bl-year">
          <span class="bl-year-num">${escapeHtml(year)}</span>
          <span class="bl-year-count">${group.length} ${group.length === 1 ? "post" : "posts"}</span>
          <span class="bl-year-line"></span>
        </div>
        <div class="bl-posts">
          ${group.map((post) => {
            const href = post.externalUrl || `./posts/${encodeURIComponent(post.slug)}.html`;
            const tags = (post.tags || []).map(tag => `<span class="bl-tag">${escapeHtml(tag)}</span>`).join("");
            const thumb = post.previewImage
              ? `<img src="${escapeHtml(post.previewImage)}" alt="" class="bl-thumb-img" loading="lazy">`
              : `<span>${escapeHtml((post.tags || [post.title])[0])}</span>`;
            const host = post.externalUrl ? hostOf(post.externalUrl) : "";
            const ext = host ? `<span class="bl-ext">${escapeHtml(host)} ↗</span>` : "";

            return `
              <a class="bl-card" href="${escapeHtml(href)}" aria-label="${escapeHtml(post.title)}">
                <div class="bl-body">
                  <div class="bl-meta">
                    <span class="bl-num">LOG_${String(post._num).padStart(2, "0")}</span>
                    <span class="bl-dot">/</span>
                    <span class="bl-date">${escapeHtml(monthDay(post.date))}</span>
                    ${ext}
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

    document.querySelectorAll(".bl-card").forEach((card, i) => {
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
      });
      if (observer) {
        card.style.transitionDelay = `${Math.min(i, 6) * 70}ms`;
        observer.observe(card);
      }
    });
  };

  renderList(posts);

  /* ---------- Mouse trail ---------- */
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

  let lastX = null;
  let lastY = null;
  const particles = [];    // tiny stardust shed while moving

  addEventListener("pointermove", (event) => {
    const dx = lastX === null ? 0 : event.clientX - lastX;
    const dy = lastY === null ? 0 : event.clientY - lastY;
    const dist = Math.hypot(dx, dy);
    lastX = event.clientX;
    lastY = event.clientY;

    if (dist > 1 && particles.length < 120) {
      const n = dist > 16 ? 2 : 1;
      for (let k = 0; k < n; k += 1) {
        if (Math.random() > Math.min(0.9, 0.3 + dist * 0.035)) continue;
        const r = Math.random();
        particles.push({
          x: event.clientX + (Math.random() - 0.5) * 12,
          y: event.clientY + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 0.7 - dx * 0.015,
          vy: (Math.random() - 0.5) * 0.7 - dy * 0.015,
          life: 1,
          decay: 0.008 + Math.random() * 0.014,
          s: r < 0.55 ? 1.2 : (r < 0.85 ? 1.8 : 2.4),
          spark: r >= 0.72,          // ~28% render as tiny 4-point stars
          ph: Math.random() * Math.PI * 2
        });
      }
    }
  });

  const frame = () => {
    ctx.clearRect(0, 0, width, height);

    // stardust
    const now = performance.now() / 1000;
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.life -= p.decay;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      const twinkle = 0.75 + 0.25 * Math.sin(now * 9 + p.ph);
      const a = Math.min(1, p.life * 1.4) * p.life * twinkle;
      ctx.globalAlpha = a;
      ctx.fillStyle = "#fff";
      const px = p.x * dpr;
      const py = p.y * dpr;
      if (p.spark) {
        // 4-point pixel star, like the main page sparkles
        const arm = p.s * 2.2 * dpr * (0.6 + 0.4 * p.life);
        const th = Math.max(1, dpr);
        ctx.fillRect(px - arm, py - th / 2, arm * 2, th);
        ctx.fillRect(px - th / 2, py - arm, th, arm * 2);
      } else {
        const sz = p.s * dpr;
        ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(frame);
  };

  frame();
})();

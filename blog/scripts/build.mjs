import fs from "fs-extra";
import path from "path";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: true, linkify: true });

const root = process.cwd();

const cDir = path.join(root, "content");
const pDir = path.join(cDir, "posts");
const inPosts = (await fs.pathExists(pDir)) ? pDir : cDir;
console.log("[build] inPosts =", inPosts);

const outRoot = root;
const outHtml = path.join(outRoot, "posts");
const outAst = path.join(outRoot, "assets");

// 너 폴더에 post.html이 루트에 있으니 그걸 템플릿으로 씀
const tplPath = path.join(outRoot, "post.html");

const esc = (s) => String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const imageExts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];

const getAttr = (tag, name) => {
    const match = String(tag || "").match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
    return match?.[1] || "";
};

const toAbsoluteUrl = (url, base) => {
    try {
        return new URL(url, base).href;
    } catch {
        return url;
    }
};

const fetchExternalFirstImage = async (url) => {
    if (!url || !/^https?:\/\//i.test(url)) return null;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const html = await res.text();
        const firstImgTag = html.match(/<img\b[^>]*src=["'][^"']+["'][^>]*>/i)?.[0];
        const firstImg = getAttr(firstImgTag, "src");
        return firstImg ? toAbsoluteUrl(firstImg, url) : null;
    } catch (err) {
        console.warn(`[build] failed to fetch external preview image: ${url}`, err?.message || err);
        return null;
    }
};

const findAssetName = async (assetDir, requestedName) => {
    if (!requestedName) return null;
    const cleanName = decodeURIComponent(requestedName).split(/[?#]/)[0];
    const exact = path.join(assetDir, cleanName);
    if (await fs.pathExists(exact)) return cleanName;

    const parsed = path.parse(cleanName);
    if (!parsed.name || !(await fs.pathExists(assetDir))) return cleanName;

    const files = await fs.readdir(assetDir);
    const byStem = files.find(file => {
        const p = path.parse(file);
        return p.name.toLowerCase() === parsed.name.toLowerCase() && imageExts.includes(p.ext.toLowerCase());
    });

    return byStem ?? cleanName;
};

const toSlug = (s) => String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/(^-|-$)/g, "");

const fmt = (d) => {
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return d;
    const m = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][x.getUTCMonth()];
    return `${m} ${x.getUTCDate()}, ${x.getUTCFullYear()}`;
};

const toDateString = (d) => {
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return String(d ?? "");
};

await fs.ensureDir(outHtml);
await fs.ensureDir(outAst);

if (!(await fs.pathExists(tplPath))) {
    throw new Error(`Template not found: ${tplPath}`);
}

const tpl = await fs.readFile(tplPath, "utf8");

const files = (await fs.readdir(inPosts, { withFileTypes: true }))
    .filter(x => x.isFile() && x.name.toLowerCase().endsWith(".md"))
    .map(x => x.name);

const posts = [];

for (const fn of files) {
    const srcMd = path.join(inPosts, fn);
    const base = fn.replace(/\.md$/i, "");

    const raw = await fs.readFile(srcMd, "utf8");
    const x = matter(raw);

    const title = x.data.title ?? base;
    const date = toDateString(x.data.date ?? "");
    const tags = Array.isArray(x.data.tags) ? x.data.tags : [];
    const excerpt = x.data.excerpt ?? "";
    const externalUrl = x.data.externalUrl ?? x.data.external_url ?? null;

    const slug = toSlug(x.data.slug ?? base);

    const srcAstDir = path.join(inPosts, base);
    const dstAstDir = path.join(outAst, slug);

    // 생성되는 글 HTML은 BLOG/posts/<slug>.html 이므로
    // 에셋은 ../assets/<slug>/... 로 접근하는 게 안전하다
    const astRel = `../assets/${encodeURIComponent(slug)}`;

    let bodyMd = String(x.content || "");

    // 네가 원하는 방식: ![](./post01/img.png) 를 자동 치환
    bodyMd = bodyMd.replaceAll(`](./${base}/`, `](${astRel}/`);
    bodyMd = bodyMd.replaceAll(`(./${base}/`, `(${astRel}/`);

    // {{asset}} 방식도 지원
    bodyMd = bodyMd.replaceAll("{{asset}}", astRel);

    const normalizeAssetUrl = async (url) => {
        const rawUrl = String(url || "").trim();
        if (!rawUrl || /^(?:https?:|mailto:|#|data:)/i.test(rawUrl)) return rawUrl;
        if (rawUrl.startsWith(astRel + "/")) return rawUrl;

        const filename = path.basename(rawUrl.split(/[?#]/)[0]);
        const assetName = await findAssetName(srcAstDir, filename);
        return `${astRel}/${encodeURIComponent(assetName)}`;
    };

    const imageMarkdownRegex = /(!\[[^\]]*\]\()([^)]+)(\))/g;
    const imageMatches = [...bodyMd.matchAll(imageMarkdownRegex)];
    for (const match of imageMatches) {
        const normalized = await normalizeAssetUrl(match[2]);
        bodyMd = bodyMd.replace(match[0], `${match[1]}${normalized}${match[3]}`);
    }

    const imageHtmlRegex = /(<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi;
    const htmlImageMatches = [...bodyMd.matchAll(imageHtmlRegex)];
    for (const match of htmlImageMatches) {
        const normalized = await normalizeAssetUrl(match[2]);
        bodyMd = bodyMd.replace(match[0], `${match[1]}${normalized}${match[3]}`);
    }

    const indexImage = x.data.index_img ? await normalizeAssetUrl(x.data.index_img) : null;
    const content = md.render(bodyMd);

    // Extract all image URLs to find a suitable preview
    const imageRegex = /<img src="([^"]+)"/g;
    const allImages = [...content.matchAll(imageRegex)].map(match => match[1]);

    const externalPreviewImage = externalUrl ? await fetchExternalFirstImage(externalUrl) : null;

    let previewImage = null;
    if (externalPreviewImage) {
        previewImage = externalPreviewImage;
    } else if (indexImage) {
        previewImage = indexImage.replace(/^\.\.\//, './');
    } else if (allImages.length > 0) {
        // Prefer the second image if it exists, otherwise fall back to the first.
        const imageUrl = allImages.length >= 2 ? allImages[1] : allImages[0];

        // The path in content is like ../assets/slug/image.png
        // For index.html, we need ./assets/slug/image.png
        previewImage = imageUrl.replace(/^\.\.\//, './');
    }

    const tagsHtml = tags
        .map(t => `<a href="../index.html?tag=${encodeURIComponent(t)}">${esc(t)}</a>`)
        .join(", ");

    const html = tpl
        .replaceAll("{{title}}", esc(title))
        .replaceAll("{{date}}", esc(date))
        .replaceAll("{{date_human}}", esc(fmt(date)))
        .replaceAll("{{tags_html}}", tagsHtml)
        .replaceAll("{{content}}", content);

    await fs.writeFile(path.join(outHtml, `${slug}.html`), html, "utf8");

    // 이미지 폴더(content/posts/post01/)가 있으면 assets/<slug>/로 복사한다
    if (await fs.pathExists(srcAstDir)) {
        await fs.ensureDir(dstAstDir);
        const xs = await fs.readdir(srcAstDir, { withFileTypes: true });
        for (const f of xs) {
            if (!f.isFile()) continue;
            await fs.copy(path.join(srcAstDir, f.name), path.join(dstAstDir, f.name), { overwrite: true });
        }
    }

    posts.push({ title, date, date_human: fmt(date), tags, excerpt, slug, previewImage, externalUrl });
}

posts.sort((a, b) => (a.date < b.date ? 1 : -1));
await fs.writeJson(path.join(outRoot, "posts.data.json"), { posts }, { spaces: 2 });

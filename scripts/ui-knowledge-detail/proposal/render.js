// UI-05B DESIGN PROPOSAL renderer (not production code). Injected by capture.cjs into the real
// UI-05 app frame; replaces <main> with the proposed layout using ONLY real API responses:
// GET /articles/{id}, GET /content-versions/{vid}/attachments, GET /attachments/{id}/download,
// GET /articles?processId=… (related, same ACL). Anything the API lacks is drawn as a dashed "Cần API" gap.
async function renderProposal({ id, tab }) {
  const api = async (p) => {
    const r = await fetch(`/api/v1${p}`, { credentials: "same-origin" });
    if (!r.ok) throw new Error(`${p} -> ${r.status}`);
    return r;
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const TZ = "Asia/Ho_Chi_Minh";
  const day = (v) => (v ? new Date(v).toLocaleDateString("vi-VN", { timeZone: TZ }) : "");
  const size = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);
  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const I = {
    back: "M20 12H4m6-6-6 6 6 6", user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0",
    dept: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6", process: "M6 7h12v10H6ZM9 3v4m6-4v4M9 17v4m6-4v4",
    calendar: "M4 5h16v16H4ZM4 10h16M9 3v4M15 3v4", version: "M12 8v4l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9",
    code: "m8 8-4 4 4 4m8-8 4 4-4 4", download: "M12 3v12m-5-5 5 5 5-5M4 21h16", check: "m5 12 4 4 10-10",
    book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2ZM4 19V5M8 7h7", image: "M4 5h16v14H4ZM4 15l4-4 4 4 3-3 5 5M15 9h.01",
    alert: "M12 3 2 21h20ZM12 10v5M12 18h.01", share: "M12 5v14M5 12h14", link: "M9 18 15 12 9 6",
  };

  const main = document.querySelector("main");
  const a = await (await api(`/articles/${id}`)).json();
  const files = await (await api(`/content-versions/${a.version_id}/attachments`)).json();
  const related = a.process_id
    ? (await (await api(`/articles?processId=${a.process_id}&pageSize=4`)).json()).items.filter((x) => x.id !== a.id).slice(0, 3)
    : [];
  const images = [];
  for (const f of files.filter((f) => f.mime_type.startsWith("image/") && f.malware_scan_status === "CLEAN"))
    images.push({ ...f, url: URL.createObjectURL(await (await api(`/attachments/${f.id}/download`)).blob()) });

  // Same rule as UI-04 parseSections: order by numeric prefix (jsonb loses key order), strip it for display.
  const sections = Object.entries(a.body)
    .filter(([, v]) => typeof v === "string")
    .map(([k, v], i) => {
      const m = k.match(/^\s*(\d+)[.)]\s*(.*)$/);
      return { order: m ? Number(m[1]) : 1000 + i, title: m ? m[2] : k, text: v };
    })
    .sort((x, y) => x.order - y.order);
  const blocks = (text) => {
    const out = []; let list = null;
    for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
      const b = line.match(/^[-•*]\s+(.*)/), n = line.match(/^\d+[.)]\s+(.*)/);
      const kind = b ? "ul" : n ? "ol" : null;
      if (kind) { if (!list || list.kind !== kind) out.push((list = { kind, items: [] })); list.items.push((b || n)[1]); }
      else { list = null; out.push({ p: line }); }
    }
    return out.map((x) => (x.p ? `<p>${esc(x.p)}</p>` : `<${x.kind}>${x.items.map((t) => `<li>${esc(t)}</li>`).join("")}</${x.kind}>`)).join("");
  };
  const caution = (t) => /an toàn|lưu ý/i.test(t);
  const backQuery = sessionStorage.getItem("jkc.knowledge.query") || "";

  const meta = [
    [I.user, "Người chia sẻ", a.author_name],
    [I.dept, "Bộ phận", a.department_name],
    [I.process, "Công đoạn", a.process_name],
    [I.calendar, "Ngày duyệt", day(a.approved_at)],
    [I.version, "Phiên bản", `v${a.version_number} · hiện hành`],
  ].filter(([, , v]) => v);

  const fileRow = (f) => {
    const pdf = f.mime_type === "application/pdf";
    return `<li><span class="p5b-fileIcon ${pdf ? "pdf" : "img"}">${pdf ? "PDF" : svg(I.image)}</span>
      <span class="p5b-fileText"><b>${esc(f.filename)}</b><small>${size(f.byte_size)} · ${f.malware_scan_status === "CLEAN" ? "Đã quét an toàn" : "Đang kiểm tra"}</small></span>
      <a class="p5b-iconBtn" href="/api/v1/attachments/${f.id}/download" aria-label="Tải ${esc(f.filename)}">${svg(I.download)}</a></li>`;
  };

  main.innerHTML = `
  <div class="p5b">
    <p class="p5b-ribbon">ĐỀ XUẤT THIẾT KẾ UI-05B · chưa triển khai · dữ liệu lấy thật từ API của một bài DEMO đã duyệt. Khung viền nét đứt = dữ liệu chưa có API.</p>
    <p class="p5b-demo">Môi trường DEMO · Nội dung minh họa, chưa dùng làm hướng dẫn vận hành.</p>
    <nav class="p5b-crumbs" aria-label="Đường dẫn">
      <a href="/knowledge${backQuery ? `?${esc(backQuery)}` : ""}">${svg(I.back)}Kho tri thức</a>
      ${a.process_name ? `<span>${esc(a.process_name)}</span>` : ""}
    </nav>
    <div class="p5b-layout">
      <div class="p5b-col">
        <header class="p5b-card p5b-head">
          <div class="p5b-top">
            <span class="p5b-kIcon">${svg(I.book)}</span>
            <div class="p5b-headText">
              <span class="p5b-code" title="Mã bài">${esc(a.code)}</span>
              <h1>${esc(a.title)}</h1>
              <div class="p5b-chips">
                <span class="ok">${svg(I.check)}Đã duyệt</span><span class="ver">v${a.version_number}</span>
                <span class="kind">Bài tri thức</span>${a.process_name ? `<span class="proc">${esc(a.process_name)}</span>` : ""}
              </div>
            </div>
          </div>
          <dl class="p5b-meta">${meta.map(([d, k, v]) => `<div>${svg(d)}<dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
        </header>
        <div class="p5b-tabs" role="tablist" aria-label="Phần của bài">
          <button role="tab" aria-selected="${tab === "content"}">Nội dung</button>
          <button role="tab" aria-selected="${tab === "files"}">Ảnh &amp; tệp (${files.length})</button>
          <button role="tab" aria-selected="${tab === "version"}">Phê duyệt</button>
        </div>
        ${images.length ? `<section class="p5b-card p5b-gallery" data-tab="files" aria-label="Hình ảnh minh họa">
          <h2>${svg(I.image)}Hình ảnh (${images.length})</h2>
          <div>${images.map((im) => `<figure><img src="${im.url}" alt="${esc(im.filename)}"><figcaption>${esc(im.filename)}</figcaption></figure>`).join("")}</div>
        </section>` : ""}
        <article class="p5b-card p5b-body" data-tab="content">
          ${sections.map((s, i) => `<section class="${caution(s.title) ? "caution" : ""}">
            <h2><span class="n">${i + 1}</span>${esc(s.title)}</h2>${caution(s.title) ? `<div class="warn">${svg(I.alert)}<div>${blocks(s.text)}</div></div>` : blocks(s.text)}
          </section>`).join("")}
        </article>
      </div>
      <aside class="p5b-side">
        <section class="p5b-card p5b-approval" data-tab="version">
          <h2>Phê duyệt &amp; phiên bản</h2>
          <ul class="p5b-timeline">
            <li class="current"><b>v${a.version_number}</b><span class="tag">Hiện hành</span><small>Duyệt ${day(a.approved_at)} · tạo ${day(a.created_at)}</small></li>
          </ul>
          <dl class="p5b-kv">
            <div><dt>Trạng thái</dt><dd class="okText">Đã duyệt</dd></div>
            <div><dt>Bộ phận duyệt</dt><dd>${esc(a.department_name || "")}</dd></div>
            <div class="gap"><dt>Người duyệt</dt><dd>Cần API (DATA-16)</dd></div>
          </dl>
          <p class="gap">Lịch sử phiên bản trước · cần API (DATA-22)</p>
        </section>
        <section class="p5b-card p5b-files" data-tab="files">
          <h2>Tệp đính kèm (${files.length})</h2>
          ${files.length ? `<ul>${files.map(fileRow).join("")}</ul>` : `<p class="p5b-muted">Bài này không có tệp đính kèm.</p>`}
        </section>
        ${related.length ? `<section class="p5b-card p5b-related" data-tab="content">
          <h2>Cùng công đoạn</h2>
          <ul>${related.map((r) => `<li><a href="/knowledge/${r.id}"><b>${esc(r.title)}</b><small>${esc(r.author_name || "")} · ${day(r.approved_at)}</small></a></li>`).join("")}</ul>
        </section>` : ""}
      </aside>
    </div>
  </div>`;
  main.dataset.tab = tab;
  // Detail pages keep the UI-02 header search on mobile (only the /knowledge list hides it, PO option A).
  document.querySelectorAll("header form").forEach((f) => f.style.setProperty("display", "flex", "important"));
  document.querySelectorAll("header span").forEach((s) => { if (s.textContent === "Kho tri thức") s.textContent = "Chi tiết bài tri thức"; });
  await Promise.all([...main.querySelectorAll("img")].map((i) => i.decode().catch(() => {})));
  main.dataset.proposalReady = "1";
}

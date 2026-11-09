"use client";
// UI-07 · Tạo bài chia sẻ kinh nghiệm (/knowledge/new, mockup 06).
// Uses the versioned authoring API only: POST/PUT /workspace/contents (revision-checked), POST
// /workspace/contents/{submit|fork}, POST /content-versions/{id}/attachments (author + DRAFT, scanned).
// Nothing is reported as done before the server answers; approval stays with the department head.
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, type User } from "./api";
import { AppFrame } from "./app-frame";
import { Icon } from "./icon";
import { formatBytes, type AttachmentFile } from "./document-detail-model";
import { articleSections, isImage } from "./knowledge-detail-model";
import {
  actionError,
  checkFile,
  composeBody,
  emptyValues,
  LIMITS,
  readBody,
  SECTIONS,
  snapshot,
  statusText,
  validate,
  type Errors,
  type FormValues,
} from "./knowledge-create-model";
import styles from "./knowledge-create.module.css";

type Process = { id: string; code: string; name: string };
type Draft = {
  id: string;
  version_id: string;
  version_number: number;
  revision: number;
  status: string;
  remark?: string | null;
};
type Workspace = Draft & {
  title: string;
  kind: string;
  body: Record<string, unknown>;
  process_id: string | null;
  can_edit: boolean;
};
type Upload = {
  key: string;
  name: string;
  size: number;
  preview: string | null;
  state: "uploading" | "error";
  error?: string;
};
type Step = "content" | "files" | "preview";
type Busy = null | "save" | "submit" | "upload" | "fork";

const status = (e: unknown) =>
  e instanceof ApiError ? e.status : e instanceof TypeError ? 0 : -1;
const fileUrl = (f: AttachmentFile) => `/api/v1/attachments/${f.id}/download`;
const clock = () =>
  new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

function Glyph({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
const glyphs = {
  back: "M20 12H4m6-6-6 6 6 6",
  doc: "M14 2H5v20h14V7Zm0 0v6h5M8 12h8M8 16h8",
  upload: "M12 16V4m-5 5 5-5 5 5M4 20h16",
  save: "M5 3h11l3 3v15H5ZM8 3v6h7V3M8 21v-7h8v7",
  send: "m22 2-7 20-4-9-9-4Z M22 2 11 13",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5c-.7.7-1 1.5-1 2.5H9c0-1-.3-1.8-1-2.5A6 6 0 0 1 12 3Z",
  lock: "M6 11h12v10H6ZM8 11V7a4 4 0 0 1 8 0v4",
  alert: "M12 3 2 21h20ZM12 10v5M12 18h.01",
  download: "M12 3v12m-5-5 5 5 5-5M4 21h16",
};

export function KnowledgeCreate() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState<User | null>(null),
    [processes, setProcesses] = useState<Process[]>([]),
    [draft, setDraft] = useState<Draft | null>(null),
    [values, setValues] = useState<FormValues>(emptyValues),
    [saved, setSaved] = useState(snapshot(emptyValues())),
    [errors, setErrors] = useState<Errors>({}),
    [files, setFiles] = useState<AttachmentFile[]>([]),
    [uploads, setUploads] = useState<Upload[]>([]),
    [busy, setBusy] = useState<Busy>(null),
    [notice, setNotice] = useState(""),
    [problem, setProblem] = useState(""),
    [loadError, setLoadError] = useState(""),
    [loading, setLoading] = useState(true),
    [step, setStep] = useState<Step>("content"),
    [drag, setDrag] = useState(false);
  const lock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const draftId = params.get("id");
  const dirty = snapshot(values) !== saved;
  const editable = !draft || draft.status === "DRAFT";

  // Load account, processes and (when ?id=) the author's latest version of that content.
  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      setLoading(true);
      setLoadError("");
      try {
        const me = await api<User>("/auth/me");
        if (!active) return;
        setUser(me);
        if (me.must_change_password) return router.replace("/account");
        if (!me.department_id) return;
        const [list, mine] = await Promise.all([
          api<Process[]>("/processes"),
          draftId
            ? api<Workspace[]>("/workspace/contents")
            : Promise.resolve([]),
        ]);
        if (!active) return;
        setProcesses(list);
        if (draftId) {
          const own = mine
            .filter(
              (c) => c.id === draftId && c.kind === "ARTICLE" && c.can_edit,
            )
            .sort((a, b) => b.version_number - a.version_number)[0];
          if (!own) {
            setLoadError(
              "Không tìm thấy bài này trong bài viết của bạn, hoặc bạn không phải tác giả.",
            );
            return;
          }
          const next: FormValues = {
            title: own.title,
            processId: own.process_id || "",
            ...readBody(own.body),
          };
          setDraft(own);
          setValues(next);
          setSaved(snapshot(next));
          setFiles(
            await api<AttachmentFile[]>(
              `/content-versions/${own.version_id}/attachments`,
            ),
          );
        }
      } catch (e) {
        if (!active) return;
        if (status(e) === 401) return router.replace("/login");
        setLoadError(actionError(status(e), (e as Error).message));
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [draftId, router]);

  // Warn before leaving with unsaved changes: browser unload + in-app links.
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => e.preventDefault();
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a[href]");
      if (!a || a.getAttribute("target") === "_blank") return;
      const href = a.getAttribute("href") || "";
      if (href.startsWith("#") || href.startsWith("/api/")) return;
      if (
        !window.confirm(
          "Bài viết có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?",
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);

  const update = (patch: Partial<FormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setNotice("");
  };
  const setSection = (n: number, text: string) =>
    setValues((v) => ({ ...v, sections: { ...v.sections, [n]: text } }));

  /** Create or save the draft; returns the fresh version state or null (errors shown in place). */
  const persist = useCallback(
    async (mode: "save" | "submit"): Promise<Draft | null> => {
      const found = validate(values, mode);
      setErrors(found);
      if (Object.keys(found).length) {
        setProblem("Kiểm tra các trường được đánh dấu.");
        setStep("content");
        return null;
      }
      if (draft && snapshot(values) === saved) return draft;
      const body = composeBody(values);
      const csrf = user!.csrf_token;
      const result = draft
        ? await api<Draft>(
            "/workspace/contents",
            {
              method: "PUT",
              body: JSON.stringify({
                content_id: draft.id,
                version_id: draft.version_id,
                revision: draft.revision,
                title: values.title.trim(),
                body,
                process_id: values.processId || null,
              }),
            },
            csrf,
          )
        : await api<Draft>(
            "/workspace/contents",
            {
              method: "POST",
              body: JSON.stringify({
                kind: "ARTICLE",
                title: values.title.trim(),
                body,
                visibility: "DEPARTMENT",
                process_id: values.processId || null,
              }),
            },
            csrf,
          );
      setDraft(result);
      setSaved(snapshot(values));
      if (!draft)
        window.history.replaceState(
          window.history.state,
          "",
          `/knowledge/new?id=${result.id}`,
        );
      return result;
    },
    [values, draft, saved, user],
  );

  async function run(kind: Exclude<Busy, null>, task: () => Promise<void>) {
    if (lock.current) return; // no double submit, even before React re-renders
    lock.current = true;
    setBusy(kind);
    setProblem("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      if (status(e) === 401) router.replace("/login");
      setProblem(actionError(status(e), (e as Error).message));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  const save = () =>
    run("save", async () => {
      const r = await persist("save");
      if (r) setNotice(`Đã lưu bản nháp lúc ${clock()}.`);
    });

  const submit = () =>
    run("submit", async () => {
      const r = await persist("submit");
      if (!r) return;
      const sent = await api<Draft>(
        "/workspace/contents/submit",
        {
          method: "POST",
          body: JSON.stringify({
            content_id: r.id,
            version_id: r.version_id,
            revision: r.revision,
            remark: "",
          }),
        },
        user!.csrf_token,
      );
      setDraft(sent);
      setNotice(
        "Đã gửi trưởng bộ phận duyệt. Bài chỉ hiển thị trong Kho tri thức sau khi được duyệt.",
      );
    });

  const fork = () =>
    run("fork", async () => {
      const r = await api<Draft>(
        "/workspace/contents/fork",
        {
          method: "POST",
          body: JSON.stringify({
            content_id: draft!.id,
            version_id: draft!.version_id,
            revision: draft!.revision,
            remark: "",
          }),
        },
        user!.csrf_token,
      );
      setDraft(r);
      setFiles([]);
      setNotice(
        `Đã tạo bản sửa v${r.version_number}. Bạn có thể chỉnh sửa và gửi duyệt lại.`,
      );
    });

  async function addFiles(list: FileList | File[]) {
    const picked = Array.from(list);
    if (!picked.length || !editable) return;
    const checked = picked.map((f) => ({ f, error: checkFile(f) }));
    const rejected: Upload[] = checked
      .filter((c) => c.error)
      .map((c) => ({
        key: `${c.f.name}-${Date.now()}-${Math.random()}`,
        name: c.f.name,
        size: c.f.size,
        preview: null,
        state: "error",
        error: c.error,
      }));
    setUploads((u) => [...rejected, ...u]);
    const ok = checked.filter((c) => !c.error).map((c) => c.f);
    if (!ok.length) return;
    await run("upload", async () => {
      const target = await persist("save"); // attachments belong to a saved draft version
      if (!target) return;
      for (const f of ok) {
        const key = `${f.name}-${Date.now()}-${Math.random()}`;
        const preview = f.type.startsWith("image/")
          ? URL.createObjectURL(f)
          : null;
        setUploads((u) => [
          { key, name: f.name, size: f.size, preview, state: "uploading" },
          ...u,
        ]);
        const form = new FormData();
        form.append("file", f);
        try {
          const done = await api<AttachmentFile>(
            `/content-versions/${target.version_id}/attachments`,
            { method: "POST", body: form },
            user!.csrf_token,
          );
          setFiles((x) => [...x, done]);
          setUploads((u) => u.filter((x) => x.key !== key));
          if (preview) URL.revokeObjectURL(preview);
        } catch (e) {
          setUploads((u) =>
            u.map((x) =>
              x.key === key
                ? {
                    ...x,
                    state: "error",
                    error: actionError(status(e), (e as Error).message),
                  }
                : x,
            ),
          );
        }
      }
      setNotice(`Đã lưu bản nháp và xử lý tệp lúc ${clock()}.`);
    });
  }

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void addFiles(e.target.files);
    e.target.value = "";
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void addFiles(e.dataTransfer.files);
  };

  const previewSections = articleSections(composeBody(values), files);
  const processName = processes.find((p) => p.id === values.processId)?.name;
  const counter = (n: number) =>
    `${(values.sections[n] || "").length.toLocaleString("vi-VN")}/${LIMITS.section.toLocaleString("vi-VN")}`;

  const actions = (
    <>
      <button
        type="button"
        className={styles.secondary}
        onClick={save}
        disabled={!!busy || !editable}
      >
        <Glyph d={glyphs.save} />
        {busy === "save" ? "Đang lưu…" : "Lưu nháp"}
      </button>
      <button
        type="button"
        className={`${styles.secondary} ${styles.previewButton}`}
        onClick={() => setStep(step === "preview" ? "content" : "preview")}
        aria-pressed={step === "preview"}
      >
        <Glyph d={glyphs.eye} />
        {step === "preview" ? "Quay lại soạn" : "Xem trước"}
      </button>
      <button
        type="button"
        className={styles.primary}
        onClick={submit}
        disabled={!!busy || !editable}
      >
        <Glyph d={glyphs.send} />
        {busy === "submit" ? "Đang gửi…" : "Gửi duyệt"}
      </button>
    </>
  );

  return (
    <AppFrame
      user={user}
      path="/knowledge"
      title="Tạo bài chia sẻ kinh nghiệm"
      onSearch={(e) => {
        e.preventDefault();
        router.push(
          `/knowledge?q=${encodeURIComponent(new FormData(e.currentTarget).get("q")?.toString() || "")}`,
        );
      }}
    >
      <main id="main" className={styles.main}>
        <header className={styles.pageHead}>
          <span className={styles.pageIcon}>
            <Glyph d={glyphs.doc} />
          </span>
          <div>
            <h1>
              {draft
                ? "Bài chia sẻ kinh nghiệm"
                : "Tạo bài chia sẻ kinh nghiệm"}
            </h1>
            <p>
              Ghi lại bài học thực tế từ công việc hằng ngày để cùng nâng cao
              chất lượng sản xuất.
            </p>
          </div>
          <Link className={styles.backLink} href="/knowledge">
            <Glyph d={glyphs.back} />
            Quay lại danh sách
          </Link>
        </header>

        {loading ? (
          <div
            className={styles.loading}
            role="status"
            aria-busy="true"
            aria-label="Đang tải biểu mẫu"
          >
            <div />
            <div />
            Đang tải biểu mẫu…
          </div>
        ) : user && !user.department_id ? (
          <section className={styles.stateCard} role="alert">
            <span className={styles.stateIcon}>
              <Glyph d={glyphs.lock} />
            </span>
            <h2>Chưa tạo được bài chia sẻ</h2>
            <p>
              Tài khoản chưa thuộc bộ phận nào nên chưa thể tạo và gửi bài. Liên
              hệ quản trị để được gán bộ phận.
            </p>
            <Link href="/knowledge">Về Kho tri thức</Link>
          </section>
        ) : loadError ? (
          <section className={styles.stateCard} role="alert">
            <span className={styles.stateIcon}>
              <Glyph d={glyphs.alert} />
            </span>
            <h2>Không mở được bài viết</h2>
            <p>{loadError}</p>
            <Link href="/knowledge/new">Tạo bài mới</Link>
          </section>
        ) : (
          <div className={styles.layout} data-step={step}>
            <div className={styles.column}>
              {draft && (
                <p
                  className={`${styles.statusBar} ${styles[draft.status] || ""}`}
                  data-testid="draft-status"
                >
                  <b>{statusText[draft.status] || draft.status}</b> · Phiên bản
                  v{draft.version_number}
                  {draft.status === "PENDING" &&
                    " · Bài đang chờ trưởng bộ phận duyệt, chưa sửa được."}
                  {draft.status === "APPROVED" && (
                    <>
                      {" · "}
                      <Link href={`/knowledge/${draft.id}`}>
                        Xem bài trong Kho tri thức
                      </Link>
                    </>
                  )}
                  {draft.remark && (
                    <span> · Ý kiến người duyệt: {draft.remark}</span>
                  )}
                </p>
              )}
              {draft &&
                ["APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(
                  draft.status,
                ) && (
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={fork}
                    disabled={!!busy}
                  >
                    {busy === "fork" ? "Đang tạo…" : "Tạo bản sửa mới"}
                  </button>
                )}

              <div
                className={styles.steps}
                role="tablist"
                aria-label="Các bước"
              >
                {(
                  [
                    ["content", "Nội dung"],
                    ["files", `Đính kèm (${files.length})`],
                    ["preview", "Xem trước"],
                  ] as [Step, string][]
                ).map(([key, label], i) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={step === key}
                    onClick={() => setStep(key)}
                  >
                    <span aria-hidden="true">{i + 1}</span>
                    {label}
                  </button>
                ))}
              </div>

              <fieldset
                className={styles.form}
                disabled={!editable}
                data-panel="content"
              >
                <section
                  className={styles.card}
                  aria-labelledby="general-title"
                >
                  <h2 id="general-title">
                    <span className={styles.num}>1</span>Thông tin chung
                  </h2>
                  <label className={styles.field}>
                    <span>
                      Tiêu đề <i aria-hidden="true">*</i>
                    </span>
                    <input
                      value={values.title}
                      maxLength={LIMITS.titleMax}
                      onChange={(e) => update({ title: e.target.value })}
                      aria-invalid={!!errors.title}
                      aria-describedby={errors.title ? "err-title" : undefined}
                      placeholder="Ví dụ: Bong mực trên bao bì flexo khi in tốc độ cao"
                    />
                    {errors.title && (
                      <small id="err-title" className={styles.fieldError}>
                        {errors.title}
                      </small>
                    )}
                  </label>
                  <div className={styles.row}>
                    <label className={styles.field}>
                      <span>
                        Công đoạn <i aria-hidden="true">*</i>
                      </span>
                      <select
                        value={values.processId}
                        onChange={(e) => update({ processId: e.target.value })}
                        aria-invalid={!!errors.processId}
                        aria-describedby={
                          errors.processId ? "err-process" : undefined
                        }
                      >
                        <option value="">Chọn công đoạn</option>
                        {processes.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      {errors.processId && (
                        <small id="err-process" className={styles.fieldError}>
                          {errors.processId}
                        </small>
                      )}
                    </label>
                    <div className={styles.field}>
                      <span>Bộ phận</span>
                      <p className={styles.readonly}>
                        Bộ phận của tài khoản bạn
                      </p>
                    </div>
                    <div className={styles.field}>
                      <span>Phạm vi chia sẻ</span>
                      <p className={styles.readonly}>
                        Trong bộ phận, sau khi được duyệt
                      </p>
                    </div>
                  </div>
                </section>

                <div className={styles.sections}>
                  {SECTIONS.map((s) => (
                    <section key={s.n} className={styles.card}>
                      <h2 id={`sec-${s.n}`}>
                        <span className={styles.num}>{s.n + 1}</span>
                        <label htmlFor={`text-${s.n}`}>
                          {s.title}
                          {s.required && <i aria-hidden="true"> *</i>}
                        </label>
                      </h2>
                      <textarea
                        id={`text-${s.n}`}
                        rows={4}
                        maxLength={LIMITS.section}
                        value={values.sections[s.n] || ""}
                        onChange={(e) => setSection(s.n, e.target.value)}
                        placeholder={s.hint}
                        aria-invalid={!!errors[`s${s.n}`]}
                        aria-describedby={`hint-${s.n}${errors[`s${s.n}`] ? ` err-${s.n}` : ""}`}
                      />
                      <div className={styles.under}>
                        <small id={`hint-${s.n}`}>
                          Mỗi dòng bắt đầu bằng &quot;-&quot; hoặc
                          &quot;1.&quot; sẽ thành danh sách.
                        </small>
                        <small>{counter(s.n)}</small>
                      </div>
                      {errors[`s${s.n}`] && (
                        <small id={`err-${s.n}`} className={styles.fieldError}>
                          {errors[`s${s.n}`]}
                        </small>
                      )}
                    </section>
                  ))}
                </div>
              </fieldset>

              <section
                className={`${styles.card} ${styles.files}`}
                aria-labelledby="files-title"
                data-panel="files"
              >
                <h2 id="files-title">
                  <span className={styles.num}>9</span>Tệp đính kèm
                  <small>Ảnh, tài liệu minh họa rõ hơn cho bài viết</small>
                </h2>
                {editable ? (
                  <div
                    className={styles.drop}
                    data-drag={drag}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDrag(true);
                    }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={onDrop}
                  >
                    <Glyph d={glyphs.upload} />
                    <p>
                      Kéo thả tệp vào đây hoặc{" "}
                      <button
                        type="button"
                        onClick={() => fileInput.current?.click()}
                        disabled={!!busy}
                      >
                        chọn tệp
                      </button>
                    </p>
                    <small>
                      Hỗ trợ PNG, JPEG, PDF (tối đa{" "}
                      {LIMITS.fileBytes / 1024 / 1024} MB mỗi tệp). Tệp được
                      quét an toàn trước khi lưu. Bài chưa lưu sẽ được lưu nháp
                      trước khi tải tệp.
                    </small>
                    <input
                      ref={fileInput}
                      type="file"
                      multiple
                      accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                      onChange={onPick}
                      hidden
                      aria-label="Chọn tệp đính kèm"
                    />
                  </div>
                ) : (
                  <p className={styles.muted}>
                    Chỉ thêm tệp vào bản nháp. Bài đang ở trạng thái “
                    {statusText[draft!.status] || draft!.status}”.
                  </p>
                )}
                {(uploads.length > 0 || files.length > 0) && (
                  <ul className={styles.fileList} aria-label="Danh sách tệp">
                    {uploads.map((u) => (
                      <li key={u.key} data-state={u.state}>
                        {u.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element -- local preview (blob:) before upload
                          <img src={u.preview} alt="" />
                        ) : (
                          <span className={styles.fileIcon}>
                            {/\.pdf$/i.test(u.name) ? "PDF" : "TỆP"}
                          </span>
                        )}
                        <span className={styles.fileName}>
                          <b title={u.name}>{u.name}</b>
                          <small>
                            {formatBytes(u.size)} ·{" "}
                            {u.state === "uploading" ? (
                              <em className={styles.uploading}>
                                Đang tải lên và quét…
                              </em>
                            ) : (
                              <em className={styles.failed} role="alert">
                                Lỗi: {u.error}
                              </em>
                            )}
                          </small>
                        </span>
                        {u.state === "error" && (
                          <button
                            type="button"
                            className={styles.dismiss}
                            onClick={() =>
                              setUploads((x) =>
                                x.filter((y) => y.key !== u.key),
                              )
                            }
                            aria-label={`Bỏ thông báo lỗi ${u.name}`}
                          >
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                    {files.map((f) => (
                      <li key={f.id} data-state="done">
                        {isImage(f) ? (
                          // eslint-disable-next-line @next/next/no-img-element -- ACL-protected API file
                          <img src={fileUrl(f)} alt="" />
                        ) : (
                          <span className={`${styles.fileIcon} ${styles.pdf}`}>
                            PDF
                          </span>
                        )}
                        <span className={styles.fileName}>
                          <b title={f.filename}>{f.filename}</b>
                          <small>
                            {formatBytes(f.byte_size)} ·{" "}
                            <em
                              className={
                                f.malware_scan_status === "CLEAN"
                                  ? styles.clean
                                  : styles.uploading
                              }
                            >
                              {f.malware_scan_status === "CLEAN"
                                ? "Đã tải lên · đã quét an toàn"
                                : "Đang chờ kiểm tra"}
                            </em>
                          </small>
                        </span>
                        {f.malware_scan_status === "CLEAN" && (
                          <a
                            className={styles.download}
                            href={fileUrl(f)}
                            aria-label={`Tải ${f.filename}`}
                          >
                            <Glyph d={glyphs.download} />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <p className={styles.muted}>
                  Muốn ảnh hiện cạnh một mục, ghi một dòng “Ảnh: tên-tệp.jpg”
                  trong mục đó (DATA-23). Chưa hỗ trợ xóa tệp đã tải lên khỏi
                  bản nháp.
                </p>
              </section>

              <article
                className={`${styles.card} ${styles.preview}`}
                data-panel="preview"
                aria-label="Xem trước bài viết"
              >
                <p className={styles.previewTag}>
                  Xem trước · chưa phải bài đã duyệt
                </p>
                <h2 className={styles.previewTitle}>
                  {values.title.trim() || "(Chưa có tiêu đề)"}
                </h2>
                <p className={styles.muted}>
                  {[processName, "Bài tri thức", user?.full_name]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {previewSections.length ? (
                  previewSections.map((s, i) => (
                    <section key={`${s.title}-${i}`}>
                      <h3>
                        <span className={styles.num}>{i + 1}</span>
                        {s.title}
                      </h3>
                      {s.blocks.map((b, j) =>
                        b.type === "p" ? (
                          <p key={j}>{b.text}</p>
                        ) : b.type === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element -- ACL-protected API file
                          <img
                            key={j}
                            src={fileUrl(b.file)}
                            alt={b.file.filename}
                          />
                        ) : b.type === "ul" ? (
                          <ul key={j}>
                            {b.items.map((t, k) => (
                              <li key={k}>{t}</li>
                            ))}
                          </ul>
                        ) : (
                          <ol key={j}>
                            {b.items.map((t, k) => (
                              <li key={k}>{t}</li>
                            ))}
                          </ol>
                        ),
                      )}
                    </section>
                  ))
                ) : (
                  <p className={styles.muted}>Chưa có nội dung để xem trước.</p>
                )}
              </article>

              {(problem || notice) && (
                <div className={styles.messages}>
                  {problem && (
                    <p className={styles.error} role="alert">
                      {problem}
                    </p>
                  )}
                  {notice && (
                    <p className={styles.notice} role="status">
                      <Icon name="check" />
                      {notice}
                    </p>
                  )}
                </div>
              )}
              <div className={styles.actions}>
                {dirty && editable && (
                  <small className={styles.unsaved}>Có thay đổi chưa lưu</small>
                )}
                {actions}
              </div>
            </div>

            <aside
              className={`${styles.card} ${styles.tips}`}
              aria-labelledby="tips-title"
            >
              <h2 id="tips-title">
                <Glyph d={glyphs.bulb} />
                Mẫu bài viết tốt
              </h2>
              <p className={styles.muted}>Một bài chia sẻ hiệu quả nên có:</p>
              <ol>
                {[
                  ["Nêu rõ vấn đề", "Mô tả hiện tượng, mức độ ảnh hưởng."],
                  [
                    "Điều kiện phát sinh",
                    "Thông tin máy móc, vật liệu, môi trường.",
                  ],
                  [
                    "Nguyên nhân",
                    "Tách giả thuyết với nguyên nhân đã xác minh.",
                  ],
                  ["Các bước kiểm tra", "Liệt kê những gì đã kiểm tra."],
                  [
                    "Cách xử lý / giải pháp",
                    "Trình bày rõ cách làm; thông số lấy từ tài liệu chính thức.",
                  ],
                  ["Kết quả đạt được", "Nêu kết quả sau khi áp dụng."],
                  [
                    "Lưu ý và phạm vi áp dụng",
                    "Điểm cần chú ý, trường hợp tương tự.",
                  ],
                ].map(([t, d]) => (
                  <li key={t}>
                    <b>{t}</b>
                    <span>{d}</span>
                  </li>
                ))}
              </ol>
              <p className={styles.muted}>
                Sau khi gửi, trưởng bộ phận duyệt bài. Bài chỉ hiển thị trong
                Kho tri thức khi đã được duyệt.
              </p>
            </aside>
          </div>
        )}
      </main>
    </AppFrame>
  );
}

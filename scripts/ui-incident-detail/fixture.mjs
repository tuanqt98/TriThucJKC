// UI-06 DEMO fixture: incident solution guides (INCIDENT_GUIDE) on the local staging stack.
// 1) seed container drafts DEMO-UI06-* guides (authoring workflow cannot create INCIDENT_GUIDE yet, see REPORT GAP);
// 2) the author uploads images/PDF through the real API (ClamAV scan + normalisation);
// 3) seed container publishes them with the department head as approver.
// Writes .local/ui06.json (chmod 600, gitignored). Generic DEMO text only; no operating parameters.
// UI_DEMO_PASSWORD=... node scripts/ui-incident-detail/fixture.mjs
import { execFileSync } from "node:child_process";
import { chmodSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { session } from "../../starter/apps/web/knowledge-tests/fixture.ts";
import { demoPdf } from "../../starter/apps/web/document-detail-tests/fixture.ts";

const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(path.join(root, "starter/apps/web/package.json"));
const { request } = require("@playwright/test");
const password = process.env.UI_DEMO_PASSWORD;
if (!password) throw new Error("Cần UI_DEMO_PASSWORD");
const project = process.env.UI_COMPOSE_PROJECT || "jkc-staging-s1";
const envFile = process.env.UI_COMPOSE_ENV || ".local/sprint1.env";

function seed(...args) {
  const out = execFileSync(
    "docker",
    ["compose", "--project-name", project, "--env-file", envFile, "-f", "deploy/compose.yml", "--profile", "demo",
      "run", "--rm", "--no-deps", "seed", "python", "-m", "app.seed_incident_guides", ...args],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  return JSON.parse(out.trim().split("\n").pop());
}
function jpeg(name) {
  const src = path.join(root, "starter/apps/web/public/images/dashboard-demo", `${name}.webp`);
  const code = "import sys,io;from PIL import Image;b=io.BytesIO();Image.open(sys.argv[1]).convert('RGB').save(b,'JPEG',quality=85);sys.stdout.buffer.write(b.getvalue())";
  return execFileSync(path.join(root, ".venv/bin/python"), ["-c", code, src], { maxBuffer: 16 << 20 });
}

const drafted = seed("draft");
const author = await session(request, drafted.main.author, password);
try {
  for (const [name, mimeType, buffer] of [
    ["DEMO-anh-tong-quan.jpg", "image/jpeg", jpeg("flexo")], // not referenced by a section -> cover
    ["DEMO-hien-tuong.jpg", "image/jpeg", jpeg("offset")], // section 1
    ["DEMO-sau-xu-ly.jpg", "image/jpeg", jpeg("quality")], // section 6
    ["DEMO-phieu-su-co.pdf", "application/pdf", demoPdf("DEMO JKC - phieu su co minh hoa, khong dung de van hanh")],
  ]) {
    const res = await author.ctx.post(`/api/v1/content-versions/${drafted.main.version_id}/attachments`, {
      headers: { "X-CSRF-Token": author.me.csrf_token },
      multipart: { file: { name, mimeType, buffer } },
    });
    if (!res.ok()) throw new Error(`Upload ${name} -> ${res.status()} ${await res.text()}`);
  }
} finally {
  await author.close();
}
const keys = Object.keys(drafted).filter((k) => k !== "token" && drafted[k].publish);
seed("publish", ...keys.map((k) => drafted[k].id));
const file = path.join(root, process.env.UI_INCIDENT_FIXTURES_OUT || ".local/ui06.json");
writeFileSync(file, JSON.stringify(drafted, null, 2));
chmodSync(file, 0o600);
console.log(JSON.stringify({ file, ...Object.fromEntries(Object.entries(drafted).map(([k, v]) => [k, v.id || v])) }));

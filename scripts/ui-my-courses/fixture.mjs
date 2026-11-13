// UI-08 screenshots: DEMO courses for "employee" in every learning state, created through the real training
// workflow (draft -> head approves and assigns with a due date -> learner API). Prints {token, ids by state}.
// UI_DEMO_PASSWORD=... node scripts/ui-my-courses/fixture.mjs
import { createRequire } from "node:module";
import path from "node:path";
import { createCourses } from "../../starter/apps/web/my-courses-tests/fixture.ts";

const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(path.join(root, "starter/apps/web/package.json"));
const { request } = require("@playwright/test");
const token = `K${Date.now().toString(36).toUpperCase()}`;
const states = {
  "not-started": { name: "QC cơ bản cho in offset", dueDays: 12, learner: "none" },
  "in-progress": { name: "An toàn lao động xưởng in", dueDays: 9, learner: "one-lesson" },
  quiz: { name: "Nhận biết lỗi phổ biến trong gia công sau in", dueDays: 6, learner: "quiz" },
  passed: { name: "Quy trình kiểm tra file trước in", dueDays: 15, learner: "pass" },
  failed: { name: "Quản lý màu cho in kỹ thuật số", dueDays: 20, learner: "fail", maxAttempts: 1 },
  overdue: { name: "Bảo quản giấy và vật tư", dueDays: -1, learner: "none" },
};
const c = await createCourses(request, process.env.UI_DEMO_PASSWORD, token, Object.values(states));
console.log(JSON.stringify({ token, ...Object.fromEntries(Object.entries(states).map(([k, s]) => [k, c[s.name].assignment])) }));

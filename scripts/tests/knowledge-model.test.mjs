import test from 'node:test';
import assert from 'node:assert/strict';
import { readState, writeState, applyFilters, defaultState, excerpt, thumbnail, detailHref, lacksDiacritics, loadAll, activeFilterCount, PAGE_SIZE } from '../../starter/apps/web/components/knowledge-model.ts';

const P = '11111111-1111-4111-8111-111111111111';
const D = '22222222-2222-4222-8222-222222222222';
const item = (i, extra = {}) => ({ id: `id-${String(i).padStart(3, '0')}`, code: `C${i}`, kind: 'ARTICLE', title: `Bài ${i}`, department_name: 'Sản xuất', owner_department_id: D, version_id: `v${i}`, version_number: 1, body: {}, status: 'APPROVED', created_at: '2026-01-01T00:00:00Z', approved_at: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`, ...extra });

test('URL ↔ trạng thái: giá trị hợp lệ được giữ, giá trị lạ bị bỏ', () => {
  const s = readState(new URLSearchParams(`q=l%E1%BB%87ch+m%C3%A0u&processId=${P}&type=INCIDENT_GUIDE&department=${D}&sort=title&page=3&view=grid`));
  assert.deepEqual(s, { q: 'lệch màu', process: P, type: 'INCIDENT_GUIDE', department: D, sort: 'title', page: 3, view: 'grid' });
  assert.deepEqual(readState(new URLSearchParams(writeState(s))), s);
  assert.deepEqual(readState(new URLSearchParams('processId=abc&type=DOCUMENT&sort=x&page=-2&view=x&department=1;drop')), defaultState);
  assert.equal(writeState(defaultState), '');
  assert.equal(readState(new URLSearchParams('page=99999')).page, 1000);
});
test('Lọc loại + bộ phận, đếm đúng tổng, phân trang và kẹp trang vượt quá', () => {
  const items = [...Array(20)].map((_, i) => item(i + 1, i % 4 === 0 ? { kind: 'INCIDENT_GUIDE' } : {}));
  items.push(item(99, { owner_department_id: null, department_name: null }));
  const all = applyFilters(items, defaultState);
  assert.equal(all.total, 21);
  assert.equal(all.items.length, PAGE_SIZE);
  assert.equal(all.pages, Math.ceil(21 / PAGE_SIZE));
  assert.equal(applyFilters(items, { ...defaultState, type: 'INCIDENT_GUIDE' }).total, 5);
  assert.equal(applyFilters(items, { ...defaultState, type: 'ARTICLE', department: D }).total, 15);
  assert.equal(applyFilters(items, { ...defaultState, department: 'unknown' }).items[0].id, 'id-099');
  const last = applyFilters(items, { ...defaultState, page: 50 });
  assert.equal(last.page, last.pages);
  assert.equal(activeFilterCount({ ...defaultState, type: 'ARTICLE', department: D }), 2);
});
test('Sắp xếp: mới duyệt nhất, cũ nhất, tên tiếng Việt; ổn định khi trùng thời điểm', () => {
  const items = [item(1, { title: 'Ép kim', approved_at: '2026-02-01T00:00:00Z' }), item(2, { title: 'Bế hộp', approved_at: '2026-03-01T00:00:00Z' }), item(3, { title: 'Đóng gáy', approved_at: null, created_at: '2026-01-15T00:00:00Z' })];
  assert.deepEqual(applyFilters(items, defaultState).items.map((i) => i.id), ['id-002', 'id-001', 'id-003']);
  assert.deepEqual(applyFilters(items, { ...defaultState, sort: 'oldest' }).items.map((i) => i.id), ['id-003', 'id-001', 'id-002']);
  assert.deepEqual(applyFilters(items, { ...defaultState, sort: 'title' }).items.map((i) => i.title), ['Bế hộp', 'Đóng gáy', 'Ép kim']);
  const tie = [item(5, { approved_at: '2026-01-01T00:00:00Z' }), item(4, { approved_at: '2026-01-01T00:00:00Z' })];
  assert.deepEqual(applyFilters(tie, defaultState).items.map((i) => i.id), ['id-004', 'id-005']);
});
test('Trích đoạn, ảnh minh họa theo công đoạn, đường dẫn chi tiết', () => {
  assert.equal(excerpt({ a: 'Dòng 1\n- gạch đầu dòng', b: 2, c: 'Kết' }), 'Dòng 1 gạch đầu dòng Kết');
  assert.equal(excerpt({ a: 'x'.repeat(300) }, 20).length, 20);
  assert.equal(excerpt(null), '');
  assert.equal(thumbnail('PREPRESS', 'ARTICLE'), '/images/dashboard-demo/prepress.webp');
  assert.equal(thumbnail('FLEXO', 'ARTICLE'), '/images/dashboard-demo/flexo.webp');
  assert.equal(thumbnail(undefined, 'INCIDENT_GUIDE'), '/images/dashboard-demo/quality.webp');
  assert.equal(detailHref({ id: 'x', kind: 'INCIDENT_GUIDE' }), '/incidents/x');
  assert.equal(detailHref({ id: 'y', kind: 'ARTICLE' }), '/knowledge/y');
});
test('Nhận biết từ khóa không dấu để gợi ý gõ có dấu', () => {
  assert.equal(lacksDiacritics('lech mau'), true);
  assert.equal(lacksDiacritics('lệch màu'), false);
  assert.equal(lacksDiacritics('đo'), false);
  assert.equal(lacksDiacritics('123'), false);
  assert.equal(lacksDiacritics('  '), false);
});
test('Snapshot: đọc đủ trang, từ chối khi vượt giới hạn hoặc dữ liệu đổi giữa chừng', async () => {
  const pages = { 1: { items: [item(1), item(2)], total: 3, page: 1, pageSize: 2 }, 2: { items: [item(3)], total: 3, page: 2, pageSize: 2 } };
  assert.equal((await loadAll(async (p) => pages[p])).length, 3);
  await assert.rejects(loadAll(async () => ({ items: [], total: 5000, page: 1, pageSize: 100 })), /vượt/);
  await assert.rejects(loadAll(async (p) => (p === 1 ? pages[1] : { ...pages[2], total: 4 })), /thay đổi/);
  await assert.rejects(loadAll(async (p) => (p === 1 ? pages[1] : { ...pages[2], items: [item(1)] })), /thay đổi/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { groupMine, actionsFor, counts, filterMine, readMineState, writeMineState, MINE_PAGE_SIZE } from '../../starter/apps/web/components/knowledge-mine-model.ts';

const me = 'u1';
const v = (id, n, status, extra = {}) => ({ id, version_id: `${id}-v${n}`, version_number: n, revision: 1, status, title: `Bài ${id}`, kind: 'ARTICLE', creator_id: me, process_id: null, created_at: `2026-11-0${n}T00:00:00Z`, can_edit: true, remark: null, ...extra });

test('Mỗi bài một dòng = phiên bản mới nhất; bỏ bài của người khác (bài đang chờ mình duyệt) và nội quy', () => {
  const rows = groupMine([
    v('a', 1, 'APPROVED'), v('a', 2, 'DRAFT'),
    v('b', 1, 'PENDING'),
    v('c', 1, 'CHANGES_REQUESTED', { remark: 'Bổ sung ảnh' }),
    v('x', 1, 'PENDING', { creator_id: 'someone-else', can_edit: false }),
    v('d', 1, 'APPROVED', { kind: 'DOCUMENT' }),
  ], me);
  assert.deepEqual(rows.map((r) => [r.id, r.status, r.versionNumber, r.publishedVersion]), [['a', 'DRAFT', 2, 1], ['b', 'PENDING', 1, null], ['c', 'CHANGES_REQUESTED', 1, null]]);
  assert.equal(rows[2].remark, 'Bổ sung ảnh');
});

test('Chỉ hiện hành động hợp lệ theo trạng thái; sửa luôn qua form /knowledge/new?id=', () => {
  const row = (status, publishedVersion = null) => ({ id: 'a', title: 't', status, versionNumber: 1, createdAt: '', processId: null, remark: null, publishedVersion });
  const labels = (s, p) => actionsFor(row(s, p)).map((a) => `${a.label} -> ${a.href}`);
  assert.deepEqual(labels('DRAFT'), ['Tiếp tục soạn -> /knowledge/new?id=a']);
  assert.deepEqual(labels('PENDING'), ['Xem bài đang chờ duyệt -> /knowledge/new?id=a']);
  assert.deepEqual(labels('CHANGES_REQUESTED'), ['Xem ý kiến và tạo bản sửa -> /knowledge/new?id=a']);
  assert.deepEqual(labels('REJECTED'), ['Xem ý kiến và tạo bản sửa -> /knowledge/new?id=a']);
  assert.deepEqual(labels('APPROVED'), ['Xem trong Kho tri thức -> /knowledge/a', 'Tạo bản sửa mới -> /knowledge/new?id=a']);
  assert.deepEqual(labels('DRAFT', 1), ['Tiếp tục soạn -> /knowledge/new?id=a', 'Xem bản v1 đang hiển thị -> /knowledge/a']);
});

test('Đếm theo trạng thái, lọc, tìm không dấu và phân trang', () => {
  const rows = groupMine([...Array(23)].map((_, i) => v(`k${String(i).padStart(2, '0')}`, 1, i % 2 ? 'DRAFT' : 'APPROVED', { title: i === 5 ? 'Lệch màu ca đêm' : `Bài ${i}` })), me);
  assert.deepEqual(counts(rows), { DRAFT: 11, PENDING: 0, CHANGES_REQUESTED: 0, REJECTED: 0, APPROVED: 12 });
  assert.equal(filterMine(rows, { status: 'DRAFT', q: '', page: 1 }).total, 11);
  assert.deepEqual(filterMine(rows, { status: '', q: 'lech MAU', page: 1 }).items.map((r) => r.title), ['Lệch màu ca đêm']);
  const p3 = filterMine(rows, { status: '', q: '', page: 9 });
  assert.equal(p3.pages, 3); assert.equal(p3.page, 3); assert.equal(p3.items.length, 23 - 2 * MINE_PAGE_SIZE);
});

test('Trạng thái lọc trên URL: giá trị lạ bị bỏ, khứ hồi ổn định', () => {
  const s = readMineState(new URLSearchParams('status=PENDING&q=m%C3%A0u&page=2'));
  assert.deepEqual(s, { status: 'PENDING', q: 'màu', page: 2 });
  assert.deepEqual(readMineState(new URLSearchParams(writeMineState(s))), s);
  assert.deepEqual(readMineState(new URLSearchParams('status=HACK&page=-1')), { status: '', q: '', page: 1 });
});

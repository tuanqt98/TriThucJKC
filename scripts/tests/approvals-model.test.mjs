import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQueue, filterQueue, departments, remarkError, resultMessage, reviewerRoles, approvedHistory, PAGE_SIZE, REMARK_MAX } from '../../starter/apps/web/components/approvals-model.ts';

const me = 'u-head';
const item = (id, extra = {}) => ({ id, version_id: `${id}-v`, version_number: 1, revision: 2, status: 'PENDING', title: `Bài ${id}`, kind: 'ARTICLE', creator_id: 'u-emp', owner_department_id: 'd1', body: {}, process_id: null, created_at: '2026-11-01T00:00:00Z', can_edit: false, can_review: true, remark: null, ...extra });
const people = [{ id: 'u-emp', full_name: 'Nhân viên demo', department_id: 'd1', department_name: 'Sản xuất' }];

test('Hàng đợi = chỉ mục máy chủ cho duyệt, đang chờ, không phải của mình; có tên người gửi và bộ phận; mới nhất trước', () => {
  const q = buildQueue([
    item('a', { created_at: '2026-11-01T00:00:00Z' }),
    item('b', { created_at: '2026-11-03T00:00:00Z', kind: 'DOCUMENT' }),
    item('own', { creator_id: me, can_review: false }),
    item('own2', { creator_id: me, can_review: true }),
    item('draft', { status: 'DRAFT' }),
    item('nope', { can_review: false }),
    item('x', { creator_id: 'unknown', owner_department_id: 'd9' }),
  ], people, me);
  assert.deepEqual(q.map((i) => i.id).sort(), ['a', 'b', 'x']);
  assert.equal(q[0].id, 'b');
  const a = q.find((i) => i.id === 'a');
  assert.equal(a.author, 'Nhân viên demo'); assert.equal(a.department, 'Sản xuất');
  const x = q.find((i) => i.id === 'x');
  assert.equal(x.author, null); assert.equal(x.department, null);
});

test('Lọc loại, bộ phận, tìm không dấu theo tiêu đề và người gửi; phân trang', () => {
  const q = buildQueue([...Array(23)].map((_, i) => item(`k${String(i).padStart(2, '0')}`, { kind: i % 2 ? 'DOCUMENT' : 'ARTICLE', title: i === 4 ? 'Lệch màu ca đêm' : `Bài ${i}` })), people, me);
  assert.equal(filterQueue(q, { kind: 'DOCUMENT', department: '', q: '', page: 1 }).total, 11);
  assert.deepEqual(filterQueue(q, { kind: '', department: '', q: 'lech MAU', page: 1 }).items.map((i) => i.title), ['Lệch màu ca đêm']);
  assert.equal(filterQueue(q, { kind: '', department: '', q: 'nhan vien demo', page: 1 }).total, 23);
  assert.equal(filterQueue(q, { kind: '', department: 'd2', q: '', page: 1 }).total, 0);
  const last = filterQueue(q, { kind: '', department: '', q: '', page: 99 });
  assert.equal(last.page, 3); assert.equal(last.items.length, 23 - 2 * PAGE_SIZE);
  assert.deepEqual(departments(q), [{ id: 'd1', name: 'Sản xuất' }]);
});

test('Lý do bắt buộc khi yêu cầu chỉnh sửa / từ chối (giống máy chủ); phê duyệt có thể để trống', () => {
  assert.equal(remarkError('approve', ''), '');
  assert.match(remarkError('request-changes', '   '), /Nhập lý do/);
  assert.match(remarkError('reject', ''), /Từ chối/);
  assert.equal(remarkError('reject', 'Trùng nội dung'), '');
  assert.match(remarkError('approve', 'x'.repeat(REMARK_MAX + 1)), /tối đa/);
  assert.match(resultMessage('approve', 'A', 2), /Đã phê duyệt “A” v2/);
  assert.match(resultMessage('request-changes', 'A', 1), /yêu cầu chỉnh sửa/);
  assert.match(resultMessage('reject', 'A', 1), /Đã từ chối/);
});

test('Vai trò duyệt theo máy chủ: trưởng bộ phận có phạm vi hoặc HR', () => {
  assert.deepEqual(reviewerRoles({ roles: [{ code: 'DEPARTMENT_HEAD', scope_department_id: 'd1' }] }), { head: true, hr: false });
  assert.deepEqual(reviewerRoles({ roles: [{ code: 'DEPARTMENT_HEAD', scope_department_id: null }] }), { head: false, hr: false });
  assert.deepEqual(reviewerRoles({ roles: [{ code: 'HR', scope_department_id: null }] }), { head: false, hr: true });
  assert.deepEqual(reviewerRoles(null), { head: false, hr: false });
});

test('Lịch sử: chỉ bản đã duyệt, mới nhất trước, giới hạn', () => {
  const rows = [{ id: '1', title: 'a', author: 'x', version_number: 1, status: 'APPROVED', requested_at: '2026-11-01T00:00:00Z' }, { id: '2', title: 'b', author: 'x', version_number: 1, status: 'PENDING', requested_at: '2026-11-05T00:00:00Z' }, { id: '3', title: 'c', author: 'x', version_number: 2, status: 'APPROVED', requested_at: '2026-11-03T00:00:00Z' }];
  assert.deepEqual(approvedHistory(rows).map((r) => r.id), ['3', '1']);
  assert.equal(approvedHistory(rows, 1).length, 1);
});

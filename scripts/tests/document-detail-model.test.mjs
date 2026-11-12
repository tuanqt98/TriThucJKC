import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSections, readingSummary, formatBytes, fileKind, ackError, sectionTitle } from '../../starter/apps/web/components/document-detail-model.ts';

const task = (extra = {}) => ({ id: 'a2', content_id: 'd1', title: 'DEMO', version_id: 'v2', version_number: 2, due_at: null, acknowledged_at: null, is_current: true, ...extra });
const now = Date.parse('2026-02-01T00:00:00Z');

test('Mục nội dung: giữ thứ tự, tách gạch đầu dòng, đổi khóa chung thành "Nội dung"', () => {
  const s = parseSections({ 'Mục đích': 'Đoạn 1\n\nĐoạn 2', 'Quy định': '- Một\n• Hai\n3. Ba', text: 'Thân bài' });
  assert.deepEqual(s.map((x) => x.title), ['Mục đích', 'Quy định', 'Nội dung']);
  assert.deepEqual(s[0].paragraphs, ['Đoạn 1', 'Đoạn 2']);
  assert.deepEqual(s[1].bullets, ['Một', 'Hai', 'Ba']);
  assert.equal(sectionTitle(' TEXT '), 'Nội dung');
});
test('Mục nội dung: bỏ giá trị rỗng, chấp nhận mảng, từ chối body không phải object', () => {
  assert.deepEqual(parseSections({ a: '', b: null, c: ['x', 'y'] }), [{ title: 'c', paragraphs: [], bullets: ['x', 'y'] }]);
  assert.deepEqual(parseSections(null), []);
  assert.deepEqual(parseSections(['x']), []);
});
test('Trạng thái đọc chỉ tính nhiệm vụ đúng phiên bản hiện hành', () => {
  assert.equal(readingSummary([task()], 'd1', 'v2', now).status, 'PENDING');
  assert.equal(readingSummary([task({ acknowledged_at: '2026-01-20T00:00:00Z' })], 'd1', 'v2', now).status, 'ACKNOWLEDGED');
  assert.equal(readingSummary([task({ due_at: '2026-01-01T00:00:00Z' })], 'd1', 'v2', now).status, 'OVERDUE');
  // Tài liệu khác hoặc phiên bản đang xem đã bị thay thế: không coi là được giao.
  assert.equal(readingSummary([task({ content_id: 'other' })], 'd1', 'v2', now).status, 'NOT_ASSIGNED');
  assert.equal(readingSummary([task({ is_current: false })], 'd1', 'v2', now).status, 'NOT_ASSIGNED');
  assert.equal(readingSummary(null, 'd1', 'v2', now).status, 'UNKNOWN');
});
test('ACK v1 không thay cho v2; báo phiên bản mới cần xác nhận riêng', () => {
  const v1 = task({ id: 'a1', version_id: 'v1', version_number: 1, is_current: false, acknowledged_at: '2025-12-01T00:00:00Z' });
  const r = readingSummary([v1, task()], 'd1', 'v2', now);
  assert.equal(r.status, 'PENDING');
  assert.equal(r.newVersionPending, true);
  assert.deepEqual(r.history.map((t) => t.version_number), [1]);
  const done = readingSummary([v1, task({ acknowledged_at: '2026-01-20T00:00:00Z' })], 'd1', 'v2', now);
  assert.equal(done.newVersionPending, false);
  assert.equal(done.history[0].acknowledged_at, '2025-12-01T00:00:00Z');
  // Chỉ có ACK v1, v2 chưa được giao: không hiện nút, không báo phải xác nhận.
  const unassigned = readingSummary([v1], 'd1', 'v2', now);
  assert.equal(unassigned.status, 'NOT_ASSIGNED');
  assert.equal(unassigned.newVersionPending, false);
});
test('Mục có số thứ tự được sắp theo số, không phụ thuộc thứ tự khóa jsonb', () => {
  const s = parseSections({ 'Ghi chú': 'x', '10. Mười': 'a', '2) Hai': 'b', '1. Một': 'c' });
  assert.deepEqual(s.map((x) => x.title), ['Một', 'Hai', 'Mười', 'Ghi chú']);
});
test('Dung lượng và loại tệp', () => {
  assert.equal(formatBytes(78), '78 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(1.2 * 1024 * 1024), '1,2 MB');
  assert.equal(formatBytes(-1), '—');
  assert.equal(fileKind({ mime_type: 'application/pdf', filename: 'a.PDF' }), 'pdf');
  assert.equal(fileKind({ mime_type: 'image/png', filename: 'a.png' }), 'image');
  assert.equal(fileKind({ mime_type: 'application/octet-stream', filename: 'b.xlsx' }), 'sheet');
});
test('Mã lỗi ACK', () => {
  assert.equal(ackError(409), 'CONFLICT');
  assert.equal(ackError(404), 'NOT_FOUND');
  assert.equal(ackError(401), 'SESSION');
  assert.equal(ackError(403), 'FORBIDDEN');
  assert.equal(ackError(500), 'OTHER');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS, composeBody, readBody, validate, snapshot, checkFile, actionError, emptyValues, LIMITS } from '../../starter/apps/web/components/knowledge-create-model.ts';
import { articleSections } from '../../starter/apps/web/components/knowledge-detail-model.ts';

const values = (patch = {}) => ({ ...emptyValues(), title: 'DEMO · Bài thử', processId: 'p1', ...patch });

test('Lưu rồi đọc lại: đúng ô, đúng thứ tự (khóa có số), bỏ mục rỗng, giữ mục lạ', () => {
  const v = values({ sections: { 7: 'an toàn', 1: 'mô tả', 3: '  ', 5: '- a\n- b' }, extra: { 'Ghi chú riêng': 'x' } });
  const body = composeBody(v);
  assert.deepEqual(Object.keys(body), ['1. Mô tả vấn đề / kinh nghiệm', '5. Giải pháp / quy trình thao tác', '7. Lưu ý an toàn và phạm vi áp dụng', 'Ghi chú riêng']);
  // Simulate jsonb reordering (shorter keys first) before reading back.
  const shuffled = Object.fromEntries(Object.entries(body).sort((a, b) => a[0].length - b[0].length));
  assert.deepEqual(readBody(shuffled), { sections: { 1: 'mô tả', 5: '- a\n- b', 7: 'an toàn' }, extra: { 'Ghi chú riêng': 'x' } });
  assert.deepEqual(articleSections(shuffled).map((s) => s.title), ['Mô tả vấn đề / kinh nghiệm', 'Giải pháp / quy trình thao tác', 'Lưu ý an toàn và phạm vi áp dụng', 'Ghi chú riêng']);
  assert.equal(SECTIONS.length, 7);
});

test('Bản nháp cũ (form trước, mockup 06) mở vào đúng ô', () => {
  const r = readBody({ 'Mô tả vấn đề': 'a', 'Giải pháp đề xuất': 'b', 'Kết quả': 'c', 'Lưu ý an toàn': 'd', '4. Các bước đã kiểm tra': 'e', text: 'f' });
  assert.deepEqual(r.sections, { 1: 'a', 5: 'b', 6: 'c', 7: 'd', 4: 'e' });
  assert.deepEqual(r.extra, { text: 'f' });
  assert.deepEqual(readBody(null), { sections: {}, extra: {} });
});

test('Kiểm tra dữ liệu: lưu nháp chỉ cần tiêu đề; gửi duyệt cần công đoạn và mô tả', () => {
  assert.deepEqual(validate(values({ title: '' }), 'save'), { title: 'Nhập tiêu đề bài chia sẻ.' });
  assert.match(validate(values({ title: 'abc' }), 'save').title, /ít nhất 5/);
  assert.match(validate(values({ title: 'x'.repeat(201) }), 'save').title, /tối đa 200/);
  assert.deepEqual(validate(values(), 'save'), {});
  const e = validate(values({ processId: '' }), 'submit');
  assert.deepEqual(Object.keys(e).sort(), ['processId', 's1']);
  assert.match(validate(values({ sections: { 2: 'x'.repeat(LIMITS.section + 1), 1: 'ok' } }), 'submit').s2, /Tối đa/);
});

test('Phát hiện thay đổi chưa lưu bỏ qua khoảng trắng thừa và mục rỗng', () => {
  assert.equal(snapshot(values({ title: ' DEMO · Bài thử ', sections: { 2: '  ' } })), snapshot(values()));
  assert.notEqual(snapshot(values({ sections: { 1: 'x' } })), snapshot(values()));
});

test('Kiểm tra tệp trước khi tải (máy chủ vẫn kiểm tra lại và quét)', () => {
  assert.equal(checkFile({ name: 'a.png', size: 10, type: 'image/png' }), '');
  assert.equal(checkFile({ name: 'a.JPG', size: 10, type: 'image/jpeg' }), '');
  assert.equal(checkFile({ name: 'a.pdf', size: 10, type: 'application/pdf' }), '');
  assert.match(checkFile({ name: 'a.txt', size: 10, type: 'text/plain' }), /PNG, JPEG/);
  assert.match(checkFile({ name: 'a.png', size: 10, type: 'image/svg+xml' }), /PNG, JPEG/);
  assert.match(checkFile({ name: 'a.png', size: LIMITS.fileBytes + 1, type: 'image/png' }), /10 MB/);
  assert.match(checkFile({ name: 'a.png', size: 0, type: 'image/png' }), /rỗng/);
});

test('Thông báo lỗi không báo thành công giả', () => {
  assert.match(actionError(0, ''), /chưa được ghi nhận/);
  assert.match(actionError(409, ''), /Tải lại/);
  assert.match(actionError(403, ''), /không có quyền/);
  assert.equal(actionError(422, 'Tệp bị phát hiện có mã độc.'), 'Tệp bị phát hiện có mã độc.');
});

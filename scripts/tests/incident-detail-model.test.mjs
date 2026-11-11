import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionKind, isHypothesis, defaultOpen } from '../../starter/apps/web/components/incident-detail-model.ts';

test('Nhận dạng vai trò mục theo tiêu đề đã duyệt (không dấu, không phân biệt hoa thường)', () => {
  const cases = {
    'Hiện tượng': 'symptom', 'Mô tả sự cố': 'symptom', 'Điều kiện xảy ra': 'condition', 'Nguyên nhân nghi ngờ': 'cause',
    'NGUYEN NHAN': 'cause', 'Các bước kiểm tra': 'check', 'Kết quả sau xử lý': 'result', 'Giải pháp xử lý': 'solution',
    'Cách khắc phục': 'solution', 'Lưu ý phòng ngừa': 'prevention', 'Lưu ý an toàn': 'safety', 'Lưu ý': 'safety', 'Phụ lục': 'other',
  };
  for (const [title, kind] of Object.entries(cases)) assert.equal(sectionKind(title), kind, title);
});

test('Chỉ nguyên nhân viết dạng giả thuyết mới gắn nhãn chưa xác minh', () => {
  assert.equal(isHypothesis('Nguyên nhân nghi ngờ'), true);
  assert.equal(isHypothesis('Giả thuyết nguyên nhân'), true);
  assert.equal(isHypothesis('Nguyên nhân'), false);
});

test('Mobile mở sẵn hiện tượng, nguyên nhân, giải pháp; không có thì mở mục đầu', () => {
  const s = (title) => ({ title, caution: false, blocks: [] });
  assert.deepEqual([...defaultOpen([s('Hiện tượng'), s('Điều kiện'), s('Nguyên nhân nghi ngờ'), s('Các bước kiểm tra'), s('Giải pháp xử lý'), s('Kết quả sau xử lý')])], [0, 2, 4]);
  assert.deepEqual([...defaultOpen([s('Phụ lục'), s('Ghi chú')])], [0]);
  assert.deepEqual([...defaultOpen([])], []);
});

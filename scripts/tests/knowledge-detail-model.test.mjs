import test from 'node:test';
import assert from 'node:assert/strict';
import { articleSections, splitImages, businessCode, relatedArticles, libraryHref, shouldGoBack } from '../../starter/apps/web/components/knowledge-detail-model.ts';

const file = (id, filename, mime = 'image/jpeg', scan = 'CLEAN') => ({ id, filename, mime_type: mime, byte_size: 10, sha256: 'x', malware_scan_status: scan });

test('Mục theo đúng số thứ tự, không phụ thuộc thứ tự khóa JSONB; khóa không số đứng sau', () => {
  // Same key order PostgreSQL jsonb returned on staging (shorter keys first): 1, 2, 5, 3, 4, 6.
  const body = { '1. Mô tả vấn đề': 'a', '2. Điều kiện': 'b', '5. Kết quả': 'e', 'Ghi chú': 'z', '3. Các bước': 'c', '4. Cách xử lý': 'd', '6. Lưu ý an toàn': 'f', '10. Phụ lục': 'g' };
  assert.deepEqual(articleSections(body).map((s) => s.title), ['Mô tả vấn đề', 'Điều kiện', 'Các bước', 'Cách xử lý', 'Kết quả', 'Lưu ý an toàn', 'Phụ lục', 'Ghi chú']);
  assert.deepEqual(articleSections(body).map((s) => s.caution), [false, false, false, false, false, true, false, false]);
  assert.deepEqual(articleSections({ text: 'x' })[0].title, 'Nội dung');
  assert.deepEqual(articleSections(null), []);
  assert.deepEqual(articleSections({ '1. Rỗng': '   ', '2. Null': null }), []);
});

test('Đoạn văn, gạch đầu dòng và danh sách đánh số giữ nguyên thứ tự xuất hiện', () => {
  const [s] = articleSections({ '1. Bước': 'Mở đầu\n- a\n- b\n1. x\n2) y\nKết' });
  assert.deepEqual(s.blocks, [
    { type: 'p', text: 'Mở đầu' },
    { type: 'ul', items: ['a', 'b'] },
    { type: 'ol', items: ['x', 'y'] },
    { type: 'p', text: 'Kết' },
  ]);
});

test('Ảnh theo từng bước: dòng là tên tệp ảnh sạch của phiên bản; ảnh đại diện = ảnh đầu chưa đặt vào bước', () => {
  const files = [file('a', 'DEMO-anh-hien-tuong.jpg'), file('b', 'DEMO-anh-sau-xu-ly.jpg'), file('c', 'phieu.pdf', 'application/pdf'), file('d', 'cho-quet.png', 'image/png', 'PENDING'), file('e', 'them.jpg')];
  const sections = articleSections({ '1. Kết quả': 'Đạt.\nẢnh: demo-anh-sau-xu-ly.JPG\ncho-quet.png\nphieu.pdf' }, files);
  assert.deepEqual(sections[0].blocks.map((b) => b.type === 'image' ? `img:${b.file.id}` : b.type === 'p' ? b.text : b.type), ['Đạt.', 'img:b', 'cho-quet.png', 'phieu.pdf']);
  const { cover, gallery, all } = splitImages(files, sections);
  assert.equal(cover.id, 'a');
  assert.deepEqual(gallery.map((f) => f.id), ['e']);
  assert.deepEqual(all.map((f) => f.id), ['a', 'b', 'e']);
  assert.equal(splitImages([file('c', 'p.pdf', 'application/pdf')], []).cover, null);
});

test('Ẩn mã kỹ thuật S1-<uuid>, giữ mã nghiệp vụ', () => {
  assert.equal(businessCode('S1-0fb59d84-bb28-4068-b464-0ae299411a04'), '');
  assert.equal(businessCode('JKC-QD-001'), 'JKC-QD-001');
  assert.equal(businessCode('S1-ABC'), 'S1-ABC');
  assert.equal(businessCode(null), '');
});

test('Cùng công đoạn bỏ bài hiện tại, tối đa 3 bài', () => {
  const items = ['x', 'cur', 'y', 'z', 'w'].map((id) => ({ id }));
  assert.deepEqual(relatedArticles(items, 'cur').map((i) => i.id), ['x', 'y', 'z']);
});

test('Quay lại Kho tri thức: chỉ giữ tham số UI-05 hợp lệ; history.back chỉ khi mở từ thư viện trong cùng tab', () => {
  const P = '11111111-1111-4111-8111-111111111111';
  assert.equal(libraryHref(`q=l%E1%BB%87ch&processId=${P}&type=ARTICLE&page=2&view=grid&sort=title`), `/knowledge?q=l%E1%BB%87ch&processId=${P}&type=ARTICLE&sort=title&page=2&view=grid`);
  assert.equal(libraryHref('next=https://evil.example&processId=abc'), '/knowledge');
  assert.equal(libraryHref(null), '/knowledge');
  assert.equal(shouldGoBack('a', 'a', 3), true);
  assert.equal(shouldGoBack('a', 'a', 1), false); // new tab / direct open
  assert.equal(shouldGoBack('b', 'a', 3), false); // came from a related article
  assert.equal(shouldGoBack(null, 'a', 3), false);
});

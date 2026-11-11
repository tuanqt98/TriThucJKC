import test from 'node:test';
import assert from 'node:assert/strict';
import { counts, progress, ctaLabel, filterCourses, upcoming, recentResults, resultCandidates, quizGate, submission, score, labelOf } from '../../starter/apps/web/components/learning-model.ts';

const item = (id, status, extra = {}) => ({ id, title: `Khóa ${id}`, version_number: 1, due_at: null, completed_at: null, status, completed_lessons: 0, total_lessons: 2, ...extra });

test('Đếm theo trạng thái backend; nhãn tiếng Việt; trạng thái lạ không làm hỏng', () => {
  const c = counts([item('a', 'NOT_STARTED'), item('b', 'IN_PROGRESS'), item('c', 'COMPLETED'), item('d', 'OVERDUE'), item('e', 'FAILED'), item('f', 'WEIRD')]);
  assert.deepEqual(c, { NOT_STARTED: 1, IN_PROGRESS: 1, COMPLETED: 1, OVERDUE: 1, FAILED: 1 });
  assert.equal(labelOf('FAILED'), 'Không đạt');
  assert.equal(labelOf('WEIRD'), 'WEIRD');
});

test('Tiến độ chỉ từ số bài học backend; không có bài học thì không suy ra %', () => {
  assert.deepEqual(progress({ completed_lessons: 1, total_lessons: 3 }), { done: 1, total: 3, percent: 33 });
  assert.deepEqual(progress({ completed_lessons: 5, total_lessons: 2 }), { done: 2, total: 2, percent: 100 });
  assert.equal(progress({ completed_lessons: 0, total_lessons: 0 }), null);
});

test('Nút hành động theo trạng thái', () => {
  assert.equal(ctaLabel(item('a', 'NOT_STARTED')), 'Bắt đầu học');
  assert.equal(ctaLabel(item('a', 'IN_PROGRESS', { completed_lessons: 1 })), 'Tiếp tục học');
  assert.equal(ctaLabel(item('a', 'OVERDUE')), 'Bắt đầu học');
  assert.equal(ctaLabel(item('a', 'COMPLETED')), 'Xem lại khóa học');
  assert.equal(ctaLabel(item('a', 'FAILED')), 'Xem kết quả');
});

test('Lọc trạng thái + tìm không dấu; hạn sắp tới bỏ khóa đã hoàn thành và khóa không có hạn', () => {
  const list = [item('1', 'IN_PROGRESS', { title: 'An toàn lao động xưởng' }), item('2', 'COMPLETED', { due_at: '2026-01-01T00:00:00Z' }), item('3', 'OVERDUE', { due_at: '2026-01-03T00:00:00Z' }), item('4', 'NOT_STARTED', { due_at: '2026-01-02T00:00:00Z' })];
  assert.deepEqual(filterCourses(list, '', 'an toan XUONG').map((i) => i.id), ['1']);
  assert.deepEqual(filterCourses(list, 'OVERDUE', '').map((i) => i.id), ['3']);
  assert.deepEqual(upcoming(list).map((i) => i.id), ['4', '3']);
});

test('Kết quả gần đây: chỉ lần đã nộp, mới nhất trước; chọn khóa đọc chi tiết bỏ NOT_STARTED, chia đôi ngân sách', () => {
  const d = (title, attempts) => ({ id: title, detail: { title, attempts } });
  const a = (id, at, passed) => ({ id, attempt_no: 1, score: passed ? '100.00' : '0.00', passed, correct_count: 0, question_count: 2, submitted_at: at, pass_score_snapshot: '70' });
  const r = recentResults([d('X', [a('x1', '2026-01-01T00:00:00Z', false), a('x2', null, null)]), d('Y', [a('y1', '2026-01-05T00:00:00Z', true)])]);
  assert.deepEqual(r.map((x) => [x.title, x.id]), [['Y', 'y1'], ['X', 'x1']]);
  const many = [...Array(20)].map((_, i) => item(`c${i}`, 'COMPLETED', { completed_at: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z` }));
  const others = [item('f', 'FAILED', { due_at: '2026-02-01T00:00:00Z' }), item('n', 'NOT_STARTED')];
  const picked = resultCandidates([...many, ...others], 10).map((i) => i.id);
  assert.equal(picked.length, 10);
  assert.ok(picked.includes('f') && !picked.includes('n'));
  assert.equal(picked[0], 'c19');
  assert.deepEqual(resultCandidates([item('only', 'COMPLETED')], 10).map((i) => i.id), ['only']);
});

test('Điều kiện làm bài giống API; payload chỉ khi trả lời đủ, đúng lựa chọn của câu', () => {
  const base = { id: 'a', title: 't', course_version_id: 'v', version_number: 1, pass_score: '70', max_attempts: 2, completed_at: null,
    lessons: [{ id: 'l1', title: '', body: {}, completed: true }, { id: 'l2', title: '', body: {}, completed: false }],
    questions: [{ id: 'q1', question: '', options: [{ id: 'o1', answer_text: 'A' }, { id: 'o2', answer_text: 'B' }] }], attempts: [] };
  assert.match(quizGate(base).blocked, /Hoàn thành các bài học/);
  const ready = { ...base, lessons: base.lessons.map((l) => ({ ...l, completed: true })) };
  assert.equal(quizGate(ready).blocked, '');
  const used = { ...ready, attempts: [{ id: 'x', attempt_no: 1, submitted_at: 'z', passed: false }, { id: 'y', attempt_no: 2, submitted_at: 'z', passed: false }] };
  assert.match(quizGate(used).blocked, /hết số lần/);
  assert.match(quizGate({ ...ready, attempts: [{ id: 'x', attempt_no: 1, submitted_at: 'z', passed: true }] }).blocked, /đã đạt/);
  assert.match(quizGate({ ...ready, pass_score: null }).blocked, /chưa có bài kiểm tra/);
  const pending = { ...ready, attempts: [{ id: 'p', attempt_no: 1, submitted_at: null, passed: null }] };
  assert.equal(quizGate(pending).pending.id, 'p');
  assert.equal(submission(ready, {}), null);
  assert.equal(submission(ready, { q1: 'zz' }), null);
  assert.deepEqual(submission(ready, { q1: 'o2' }), { answers: [{ question_id: 'q1', option_id: 'o2' }] });
  assert.equal(score('80.50'), '80,5');
  assert.equal(score(null), '—');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {documentRows,filterDocuments,loadDocumentSnapshot,emptyFilters} from '../../starter/apps/web/components/documents-model.ts';
const doc=(id='d1',version='v2')=>({id,version_id:version,title:'DEMO · Nội quy an toàn',code:'JKC-QD-001',owner_department_id:'production',department_name:'Sản xuất',version_number:2,status:'APPROVED',kind:'DOCUMENT',body:{},created_at:'2026-01-01T00:00:00Z'});
const task=(extra={})=>({id:'a1',content_id:'d1',version_id:'v2',version_number:2,title:'DEMO',due_at:'2026-01-01T00:00:00Z',acknowledged_at:null,is_current:true,...extra});
const now=Date.parse('2026-02-01T00:00:00Z');
test('ACK lịch sử v1 không đánh dấu đã đọc v2',()=>{
 assert.equal(documentRows([doc()],[task({version_id:'v1',is_current:false,acknowledged_at:'2025-12-01T00:00:00Z'})],now)[0].readingState,'NOT_ASSIGNED');
 assert.equal(documentRows([doc()],[task({version_id:'v1',is_current:true,acknowledged_at:'2025-12-01T00:00:00Z'})],now)[0].readingState,'NOT_ASSIGNED');
});
test('ACK khớp phiên bản có ưu tiên hơn hạn đã qua',()=>assert.equal(documentRows([doc()],[task({acknowledged_at:'2026-01-15T00:00:00Z'})],now)[0].readingState,'ACKNOWLEDGED'));
test('Quá hạn so thời điểm UTC, đúng hạn không bị gắn quá hạn',()=>{
 assert.equal(documentRows([doc()],[task()],now)[0].readingState,'OVERDUE');
 assert.equal(documentRows([doc()],[task({due_at:new Date(now).toISOString()})],now)[0].readingState,'PENDING');
 assert.equal(documentRows([doc()],[task({due_at:null})],now)[0].readingState,'PENDING');
});
test('Mất nguồn reading là UNKNOWN, không phải không được giao',()=>{
 const rows=documentRows([doc()],null,now);assert.equal(rows[0].readingState,'UNKNOWN');
 assert.equal(filterDocuments(rows,{...emptyFilters,required:'no'}).length,0);
});
test('Lọc kết hợp mã/tên không dấu, bộ phận, version và nhiệm vụ',()=>{
 const rows=documentRows([doc(),{...doc('d2','v1'),owner_department_id:'technical',version_number:1}], [task()],now);
 assert.equal(filterDocuments(rows,{...emptyFilters,query:'noi quy an toan',department:'production',version:'2',reading:'OVERDUE',required:'yes',publication:'APPROVED'}).length,1);
 assert.equal(filterDocuments(rows,{...emptyFilters,query:'jkc-qd-001'}).length,2);
 assert.equal(filterDocuments(rows,{...emptyFilters,department:'outside'}).length,0);
});
test('Đọc đủ các API page trước khi áp dụng bộ lọc',async()=>{
 const pages=[];const rows=await loadDocumentSnapshot(async page=>{pages.push(page);return {items:[doc('d'+page)],page,total:3,pageSize:1};});
 assert.deepEqual(pages,[1,2,3]);assert.equal(rows.length,3);
});
test('Từ chối snapshot thay đổi/thiếu/trùng thay vì đếm sai',async()=>{
 await assert.rejects(()=>loadDocumentSnapshot(async page=>({items:[doc()],page,total:2,pageSize:1})),/vừa thay đổi/);
 await assert.rejects(()=>loadDocumentSnapshot(async page=>({items:[doc('d'+page)],page,total:page===1?2:3,pageSize:1})),/vừa thay đổi/);
 await assert.rejects(()=>loadDocumentSnapshot(async page=>({items:[],page,total:1,pageSize:100})),/vừa thay đổi/);
});
test('Từ chối snapshot quá lớn trước khi tải thêm',async()=>{
 let calls=0;await assert.rejects(()=>loadDocumentSnapshot(async page=>{calls++;return {items:[],page,total:2001,pageSize:100};}),/2.000/);assert.equal(calls,1);
});

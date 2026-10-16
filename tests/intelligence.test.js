import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAPN,apnVariants,apnClause,geoExtent,isoDate,
  mapCERecord,asStatusResult,INTELLIGENCE_LAYERS,CE_LAYER_AS_OF
} from '../src/shared/intelligence-core.js';

test('normalizes 9-digit / 12-digit APNs without allowing a user-provided query',()=>{
  assert.equal(normalizeAPN('205-131-012'),'205131012');
  assert.equal(normalizeAPN('205-131-012-000'),'205131012000');
  assert.throws(()=>normalizeAPN("1' OR 1=1"),/9 or 12 digits/);
  assert.throws(()=>normalizeAPN(''),/9 or 12 digits/);
  assert.ok(apnVariants('205131012').includes('205-131-012-000'));
  assert.ok(apnVariants('205131012').includes('205-131-012'));
  assert.match(apnClause('APN_1','205131012'),/APN_1='205-131-012-000'/);
  assert.throws(()=>apnClause('ADDRESS','205131012'),/not supported/);
});

test('code enforcement adapts known published county fields, never invents current case status',()=>{
  const rec=mapCERecord({
    APN_1:'205-131-012-000',RECORD_ID:'CE-987',
    Type_of_Case_1:'Building',DATE_OPENED_1:Date.UTC(2024,2,3)
  });
  assert.equal(rec.case_number,'CE-987');
  assert.equal(rec.case_type,'Building');
  assert.equal(rec.date_opened,'2024-03-03');
  assert.equal(rec.snapshot_date,'2025-01-15');
  assert.equal(CE_LAYER_AS_OF,'2025-01-15');
  assert.equal(rec.status,undefined);
  assert.equal(mapCERecord({DATE_OPENED_1:null}).date_opened,null);
  assert.equal(isoDate(null),null);
});

test('geographic search is explicit bounding-box candidate only',()=>{
  const e=geoExtent({type:'Polygon',coordinates:[[[-124.2,40.8],[-124.1,40.8],[-124.1,40.9],[-124.2,40.9],[-124.2,40.8]]]});
  assert.deepEqual(e,{xmin:-124.2,xmax:-124.1,ymin:40.8,ymax:40.9});
  assert.equal(geoExtent({type:'Point',coordinates:[0,0]}),null);
  assert.equal(geoExtent({type:'Polygon',coordinates:[]}),null);
  const hit=asStatusResult('zoning',[{attributes:{ZONING:'R-1',Q:'',Q_DESCRIP:null,PII:'ignored'}}]);
  assert.equal(hit.status,'potential_intersection');
  assert.equal(hit.query_method,'parcel_extent_intersection');
  assert.equal(hit.records[0].ZONING,'R-1');
  assert.equal(hit.records[0].PII,undefined);
  const none=asStatusResult('zoning',[]);
  assert.equal(none.status,'no_extent_matches');
  const fail=asStatusResult('zoning',[], '503 timeout');
  assert.equal(fail.status,'unavailable');
  assert.equal(fail.records.length,0);
  assert.ok(Object.keys(INTELLIGENCE_LAYERS).length>=9);
});

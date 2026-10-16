import test from 'node:test';
import assert from 'node:assert/strict';
import {constructParcelQuery,safeSearchTerm} from '../api/gis.js';
import {geometryExtent,parcelCenter,apn,fmtAcres,dateValue,inHumboldtBox} from '../src/data/parcels.js';

test('point query is bounded and targets WGS84 county parcels',()=>{
  const q=constructParcelQuery('point',{lon:-124.102,lat:40.948});
  assert.equal(q.get('geometry'),'-124.102,40.948');
  assert.equal(q.get('geometryType'),'esriGeometryPoint');
  assert.equal(q.get('inSR'),'4326');
  assert.equal(q.get('f'),'geojson');
  assert.equal(q.get('outFields'),'*');
  assert.throws(()=>constructParcelQuery('point',{lon:0,lat:0}),/Humboldt/);
  assert.throws(()=>constructParcelQuery('point',{lon:'NaN',lat:41}),/Humboldt/);
  assert.equal(inHumboldtBox(-124.1,40.95),true);
  assert.equal(inHumboldtBox(-120,40.95),false);
});
test('search is restricted to parcel fields and rejects trivially empty searches',()=>{
  const q=constructParcelQuery('search',{q:'123 456-789'});
  assert.match(q.get('where'),/APN_12 LIKE/);
  assert.match(q.get('where'),/FULLADDR LIKE/);
  assert.doesNotMatch(q.get('where'),/DROP TABLE/i);
  assert.equal(safeSearchTerm("abc'; DROP TABLE users;--"),'abc DROP TABLE users --');
  assert.throws(()=>constructParcelQuery('search',{q:'a'}),/at least two/);
});
test('geometry and parcel helpers use real feature properties without inventing fields',()=>{
  const feat={
    type:'Feature',
    properties:{APN_12:'509-120-003',FULLADDR:'Example road',ACRES:1.25},
    geometry:{type:'Polygon',coordinates:[[[-124.10,40.94],[-124.09,40.94],[-124.09,40.95],[-124.10,40.95],[-124.10,40.94]]]}
  };
  assert.equal(apn(feat),'509-120-003');
  assert.equal(fmtAcres(feat.properties.ACRES),'1.25 ac');
  assert.deepEqual(geometryExtent(feat),{west:-124.1,east:-124.09,south:40.94,north:40.95});
  assert.ok(Math.abs(parcelCenter(feat).lat-40.945)<.00001);
  assert.equal(fmtAcres(null),'Not available');
  assert.equal(dateValue(null),'Not available');
});

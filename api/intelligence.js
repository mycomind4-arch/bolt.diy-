/**
 * GET /api/intelligence?apn=NNN-NNN-NNN
 * Live read-only county GIS enrichment. Ported from user's FairProcess
 * CE pipeline / multi-agent recon; intentionally no FairProcess private D1/R2 data.
 * No unrestricted crawling or people/owner information.
 */
import {
  GIS_ROOT,CE_LAYER,CE_LAYER_AS_OF,INTELLIGENCE_LAYERS,
  apnClause,normalizeAPN,geoExtent,mapCERecord,asStatusResult
} from '../src/shared/intelligence-core.js';

const PARCELS=GIS_ROOT+'/Parcels/Parcels/MapServer/0';
const CE_FIELDS='APN_1,RECORD_ID,Type_of_Case_1,DATE_OPENED_1';

const CACHE_HEADERS={
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'public, max-age=30, s-maxage=600'
};
function output(res,status,payload){
  res.statusCode=status;
  for(const [k,v]of Object.entries(CACHE_HEADERS))res.setHeader(k,v);
  res.end(JSON.stringify(payload));
}
async function arcgis(url,params,deadline){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),deadline);
  try{
    const response=await fetch(url+'/query',{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','Accept':'application/json'},
      body:new URLSearchParams(params).toString(),
      signal:controller.signal
    });
    if(!response.ok)throw new Error('HTTP '+response.status);
    const body=await response.json();
    if(body?.error)throw new Error('ArcGIS: '+String(body.error.message||'query rejected'));
    if(!Array.isArray(body?.features))throw new Error('Unexpected ArcGIS response');
    return body.features;
  }finally{clearTimeout(timeout)}
}
async function parcelByAPN(apn){
  const clauses=[apnClause('APN_12',apn),apnClause('APN',apn)];
  const features=await arcgis(PARCELS,{
    f:'geojson',where:'('+clauses.join(') OR (')+')',
    outFields:'APN_12,APN,FULLADDR,SITCITY,ACRES,ZONING,GEN_PLAN',
    returnGeometry:'true',outSR:'4326',resultRecordCount:'5'
  },8000);
  const digits=normalizeAPN(apn);
  const matching=features.find(f=>{
    const p=f.properties||{};
    return [p.APN_12,p.APN].some(value=>{
      if(!value)return false;
      const matched=String(value).replace(/[^\d]/g,'');
      return matched===digits || matched===digits+'000' || digits===matched+'000';
    });
  });
  return matching||null;
}
async function getEnforcement(apn){
  try{
    const results=await arcgis(CE_LAYER,{
      f:'json',where:apnClause('APN_1',apn),outFields:CE_FIELDS,
      returnGeometry:'false',resultRecordCount:'200'
    },9000);
    const sorted=results.map(f=>mapCERecord(f.attributes)).filter(x=>x.case_number);
    const records=Array.from(new Map(sorted.map(r=>[r.case_number,r])).values()).sort(
      (a,b)=>(b.date_opened||'').localeCompare(a.date_opened||'')
    );
    return {
      status:records.length?'found':'no_match_in_snapshot',
      snapshot_date:CE_LAYER_AS_OF,
      records:records.slice(0,100),
      truncated:results.length>=200||records.length>100,
      source_url:CE_LAYER,
      note:'Published county layer labeled 1/15/2025. Does not establish complete or current case history.'
    };
  }catch(e){
    return {
      status:'unavailable',records:[],snapshot_date:CE_LAYER_AS_OF,
      source_url:CE_LAYER,error:String(e?.message||e).slice(0,140)
    };
  }
}
async function getSpatial(key,extent){
  const layer=INTELLIGENCE_LAYERS[key];
  const layerURL=GIS_ROOT+'/'+layer.path;
  try {
    const features=await arcgis(layerURL,{
      f:'json',geometry:JSON.stringify(extent),
      geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',
      where:'1=1',spatialRel:'esriSpatialRelIntersects',
      outFields:layer.fields.join(','),
      returnGeometry:'false',resultRecordCount:'4'
    },8000);
    return asStatusResult(key,features);
  }catch(e){
    return asStatusResult(key,[],e?.message||String(e));
  }
}
export default async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return output(res,405,{error:'Only GET supported'});}
  let apn;
  try{
    const u=new URL(req.url||'/', 'https://atlas.example');
    apn=normalizeAPN(u.searchParams.get('apn'));
  }catch(e){return output(res,400,{error:String(e.message)})}
  let parcel;
  try{parcel=await parcelByAPN(apn)}
  catch(e){
    return output(res,502,{error:'County parcel lookup unavailable',detail:String(e.message).slice(0,140)});
  }
  if(!parcel)return output(res,404,{error:'No matching parcel in current official county GIS'});
  const extent=geoExtent(parcel.geometry);
  const [enforcement,spatial]=await Promise.all([
    getEnforcement(apn),
    extent
      ?Promise.all(Object.keys(INTELLIGENCE_LAYERS).map(async key=>[key,await getSpatial(key,extent)]))
      :Promise.resolve(Object.keys(INTELLIGENCE_LAYERS).map(key=>[
        key,asStatusResult(key,[],'Parcel geometry has no valid Humboldt County extent')
      ]))
  ]);
  const p=parcel.properties||{};
  return output(res,200,{
    apn:p.APN_12||p.APN||apn,
    address:p.FULLADDR||null,
    obtained_at:new Date().toISOString(),
    origin:'Humboldt County official ArcGIS published layers via FairProcess connectors',
    parcel_source:PARCELS,
    enforcement,
    spatial:Object.fromEntries(spatial),
    spatial_precision:'bounding_box_candidates',
    disclaimers:[
      'Spatial results are parcel bounding-box candidate intersections and can include other nearby areas. Verify with official agency maps.',
      'No data, an unavailable layer, and an official confirmation of no cases are different states.',
      'The county Code Enforcement Cases layer is labeled 1/15/2025 and may omit newer or confidential enforcement records.',
      'Permits and MCSD account/connection records are not available through these verified API connectors.'
    ]
  });
}

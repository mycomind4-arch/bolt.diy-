/**
 * Humboldt Atlas property-enrichment adapters.
 * Architecture and CE/APN logic adapted from the owner's fairprocessmaps:
 * frontend/web/src/lib/ce-pipeline.ts, recon-agents.ts, humboldt.ts.
 * Geographic results must retain source, date and query-method provenance.
 */
export const GIS_ROOT='https://cty-gis-web.co.humboldt.ca.us/server/rest/services';

export const INTELLIGENCE_LAYERS=Object.freeze({
  zoning:{name:'Zoning polygons',path:'Web/Jurisdiction_Boundaries_Public/MapServer/1',fields:['ZONING','Q','Q_DESCRIP']},
  general_plan:{name:'General plan polygons',path:'Web/Jurisdiction_Boundaries_Public/MapServer/5',fields:['GEN_PLAN','COMMPLAN','CPA']},
  tsunami:{name:'Tsunami hazard mapping',path:'Web/Hazard_Pub/MapServer/10',fields:['*']},
  flood:{name:'Flood hazard mapping',path:'Web/Hazard_Pub/MapServer/13',fields:['ZONE','FLD_ZONE','FLOODWAY','FIRM_PANEL','EFF_DATE']},
  fire:{name:'Fire hazard severity',path:'Web/Hazard_Pub/MapServer/33',fields:['SRA','FHSZ','FHSZ_Description']},
  wetlands:{name:'Wetlands',path:'Web/Natural_Resources_Public/MapServer/7',fields:['*']},
  streamside:{name:'Streamside management areas',path:'Web/Natural_Resources_Public/MapServer/0',fields:['*']},
  school:{name:'School district',path:'Web/Jurisdiction_Boundaries_Public/MapServer/13',fields:['SCHOOL_DIS']},
  fire_district:{name:'Fire district',path:'Web/Jurisdiction_Boundaries_Public/MapServer/14',fields:['FIRE_DISTR','AGENCY']}
});

export const CE_LAYER=GIS_ROOT+'/Web/Housing_Public/MapServer/7';
export const CE_LAYER_AS_OF='2025-01-15';

export function normalizeAPN(apn){
  const clean=String(apn??'').replace(/[\s-]/g,'');
  if(!/^\d{9}(\d{3})?$/.test(clean)) throw new Error('APN must contain 9 or 12 digits.');
  return clean;
}
export function apnVariants(apn){
  const clean=normalizeAPN(apn);
  const twelve=clean.length===9?clean+'000':clean;
  const long=[twelve.slice(0,3),twelve.slice(3,6),twelve.slice(6,9),twelve.slice(9)].join('-');
  const short=long.slice(0,11);
  return [...new Set([long,short,clean,twelve,clean.length===12?clean.slice(0,9):clean])];
}

export function apnClause(field,apn){
  if(!['APN','APN_12','APN_1'].includes(field))throw new Error('APN query field not supported');
  return apnVariants(apn).map(x=>field+"='"+x+"'").join(' OR ');
}
export function geoExtent(geometry){
  const points=[];
  const walk=v=>{
    if(!Array.isArray(v))return;
    if(v.length>=2&&typeof v[0]==='number'&&typeof v[1]==='number'){
      if(Number.isFinite(v[0])&&Number.isFinite(v[1]))points.push(v);
      return;
    }
    v.forEach(walk);
  };
  walk(geometry?.coordinates);
  if(!points.length)return null;
  const west=Math.min(...points.map(x=>x[0])),east=Math.max(...points.map(x=>x[0]));
  const south=Math.min(...points.map(x=>x[1])),north=Math.max(...points.map(x=>x[1]));
  if(west < -124.75 || east > -123.1 || south < 39.7 || north > 41.75)return null;
  return {xmin:west,xmax:east,ymin:south,ymax:north};
}
export function isoDate(value){
  if(value==null||value==='')return null;
  const n=Number(value);
  const ms=Number.isFinite(n)&&Math.abs(n)>10000000000?n:Date.parse(String(value));
  if(!Number.isFinite(ms))return null;
  const date=new Date(ms);
  return Number.isNaN(date.getTime())?null:date.toISOString().slice(0,10);
}
export function simplifyAttributes(obj,fieldNames){
  const attrs=obj&&typeof obj==='object'?obj:{};
  const entries=fieldNames.includes('*')?Object.entries(attrs).filter(([key])=>/^(OBJECTID|NAME|TYPE|ZONE|FEATURE|CLASS|HAZARD|SOURCE|AGENCY|DATE|CATEGORY|STATUS|DESCRIPTION|WETLAND|FLOOD|STREAM|DISTRICT|ACRES|AREA)(_|$)/i.test(key)).slice(0,25)
    :fieldNames.map(key=>[key,attrs[key]]);
  return Object.fromEntries(entries.filter(([key,v])=>v!==undefined && v!==null && v!=='' && key!=='Shape'));
}
export function mapCERecord(attrs){
  const a=attrs||{};
  return {
    case_number:String(a.RECORD_ID||'').trim()||null,
    apn:String(a.APN_1||'').trim()||null,
    case_type:a.Type_of_Case_1?String(a.Type_of_Case_1):null,
    date_opened:isoDate(a.DATE_OPENED_1),
    source_url:CE_LAYER,
    snapshot_date:CE_LAYER_AS_OF
  };
}
export function asStatusResult(layerKey,features,error=null){
  const layer=INTELLIGENCE_LAYERS[layerKey];
  if(!layer)throw new Error('Unknown layer');
  const source_url=GIS_ROOT+'/'+layer.path;
  if(error)return {name:layer.name,status:'unavailable',records:[],source_url,query_method:'parcel_extent_intersection',error:String(error).slice(0,160)};
  const items=(features||[]).slice(0,3).map(f=>simplifyAttributes(f.attributes||{},layer.fields));
  return {
    name:layer.name,
    status:items.length?'potential_intersection':'no_extent_matches',
    records:items,
    source_url,
    query_method:'parcel_extent_intersection',
    qualification:'Parcel bounding-box intersection; potential overlap only. Do not treat as definitive parcel intersection or zoning determination.',
    truncated:(features||[]).length>3
  };
}

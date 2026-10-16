import { constructParcelQuery, safeSearchTerm } from '../../api/gis.js';

export const PARCEL_LAYER='https://cty-gis-web.co.humboldt.ca.us/server/rest/services/Parcels/Parcels/MapServer/0';
export const COUNTY_DOWNLOAD='https://humboldtgov.org/276/GIS-Data-Download';
export const ACCELA='https://aca-prod.accela.com/humboldt/default.aspx';
export const MCSD='https://www.mckinleyvillecsd.ca.gov/';
export const COUNTY_GIS='https://humboldtgov.org/GIS';

export const HUMBOLDT_BOUNDS=Object.freeze({west:-124.75,east:-123.1,south:39.7,north:41.75});

export function inHumboldtBox(lon,lat) {
  return Number.isFinite(lon) && Number.isFinite(lat)
    && lon>=HUMBOLDT_BOUNDS.west && lon<=HUMBOLDT_BOUNDS.east
    && lat>=HUMBOLDT_BOUNDS.south && lat<=HUMBOLDT_BOUNDS.north;
}

async function readJson(response) {
  const result=await response.json();
  if(!response.ok || result?.error) throw new Error(result?.error?.message || result?.error || 'County service request failed');
  if(result?.type!=='FeatureCollection' || !Array.isArray(result.features))
    throw new Error('County GIS returned an unexpected response');
  return result.features;
}

/** First try county endpoint. When cross-origin requests fail, retry via our restricted proxy. */
export async function queryParcels(mode, values, externalSignal) {
  const upstreamParams=constructParcelQuery(mode,values);
  const proxyParams=new URLSearchParams({mode,...Object.fromEntries(Object.entries(values).map(([k,v])=>[k,String(v)]))});
  const controller=new AbortController();
  const abort=()=>controller.abort();
  externalSignal?.addEventListener('abort',abort,{once:true});
  const timeout=setTimeout(abort,10500);
  try {
    if(externalSignal?.aborted) throw new DOMException('Cancelled','AbortError');
    try {
      return await readJson(await fetch(PARCEL_LAYER+'/query?'+upstreamParams.toString(),{
        signal:controller.signal,headers:{Accept:'application/json'}
      }));
    } catch(err) {
      if(controller.signal.aborted) throw err;
      return await readJson(await fetch('/api/gis?'+proxyParams.toString(),{
        signal:controller.signal,headers:{Accept:'application/json'}
      }));
    }
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort',abort);
  }
}

export const identifyParcel=(lon,lat,signal)=>queryParcels('point',{lon,lat},signal);
export const findParcels=(q,signal)=>queryParcels('search',{q:safeSearchTerm(q)},signal);

export function parcelProps(feature) {
  return feature?.properties || feature?.attributes || {};
}
export function apn(feature) {
  const p=parcelProps(feature);
  return p.APN_12 || p.APN12 || p.APN || null;
}
export function parcelAddress(feature) {
  const p=parcelProps(feature);
  return [p.FULLADDR,p.SITCITY,p.SITZIP].filter(Boolean).join(', ') || null;
}
export function missing(value) {
  return value===undefined || value===null || value==='' ? 'Not available' : String(value);
}
export function fmtAcres(value) {
  const n=Number(value);
  return Number.isFinite(n) && value!==null && value!=='' ? n.toLocaleString(undefined,{maximumFractionDigits:3})+' ac' : 'Not available';
}
export function dateValue(value) {
  if(value===null || value===undefined || value==='') return 'Not available';
  const ms=typeof value==='number'?value:Date.parse(value);
  if(!Number.isFinite(ms))return 'Not available';
  return new Date(ms).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'});
}
export function geometryExtent(feature) {
  const coords=[];
  const walk=(a)=>{
    if(!Array.isArray(a))return;
    if(typeof a[0]==='number' && typeof a[1]==='number'){coords.push(a);return;}
    for(const child of a)walk(child);
  };
  walk(feature?.geometry?.coordinates);
  if(!coords.length)return null;
  return {
    west:Math.min(...coords.map(c=>c[0])),
    east:Math.max(...coords.map(c=>c[0])),
    south:Math.min(...coords.map(c=>c[1])),
    north:Math.max(...coords.map(c=>c[1]))
  };
}
export function parcelCenter(feature) {
  const p=parcelProps(feature);
  const lon=Number(p.LON),lat=Number(p.LAT);
  if(p.LON!=null && p.LAT!=null && inHumboldtBox(lon,lat)) return {lon,lat};
  const ex=geometryExtent(feature);
  return ex?{lon:(ex.west+ex.east)/2,lat:(ex.south+ex.north)/2}:null;
}

export const FIELDS={
  parcel:[
    ['APN / assessor number','APN_12'],
    ['Alternate APN','APN'],
    ['Situs address','FULLADDR'],
    ['City','SITCITY'],
    ['ZIP','SITZIP'],
    ['GIS area (acres)','ACRES','acres'],
    ['Legal description (GIS)','LEGAL'],
    ['Parcel description','DESCRIPTIO'],
    ['Jurisdiction','JURIS'],
    ['Parcel portion','PORTION'],
    ['Tax rate area','TRA'],
    ['Use code','USECODE'],
    ['Latitude','LAT'],
    ['Longitude','LON']
  ],
  zoning:[
    ['Zoning code','ZONING'],
    ['General plan','GEN_PLAN'],
    ['Community plan','COMMPLAN'],
    ['Zoning date','ZONEDATE','date'],
    ['Development plan','DEVPLAN'],
    ['Zone index','ZONE_IDX'],
    ['Township','TOWNSHIP'],
    ['Range','RANGE'],
    ['Section','SECTION'],
    ['Supervisor district','SUPD_DIST'],
    ['Inspector district','INSP_DIST']
  ],
  hazards:[
    ['State responsibility area indicator','SRA'],
    ['SRA exemption indicator','SRAEXMPTD'],
    ['Flood zone indicator','FZ'],
    ['Coastal zone indicator','CZ'],
    ['Fire responsibility / agency','FR'],
    ['Hazard district / zone','ZONE_IDX'],
    ['MS4 indicator','MS4']
  ]
};

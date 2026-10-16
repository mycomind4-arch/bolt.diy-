/* Read-only, bounded proxy to official Humboldt County parcel GIS.
 * Does NOT forward caller-controlled hosts, paths, SQL expressions or secrets. */
const UPSTREAM = 'https://cty-gis-web.co.humboldt.ca.us/server/rest/services/Parcels/Parcels/MapServer/0/query';
const bounds = {west:-124.75,east:-123.1,south:39.7,north:41.75};

export function safeSearchTerm(input) {
  return String(input || '').trim().slice(0, 70)
    .replace(/[^a-zA-Z0-9\s.#-]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function constructParcelQuery(mode, values = {}) {
  const params = new URLSearchParams({
    f:'geojson', outFields:'*', returnGeometry:'true', outSR:'4326',
    resultRecordCount:'20'
  });
  if (mode === 'point') {
    const lon=Number(values.lon), lat=Number(values.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon<bounds.west || lon>bounds.east || lat<bounds.south || lat>bounds.north) {
      throw new Error('Coordinates must be within the Humboldt County area.');
    }
    params.set('geometry', lon+','+lat);
    params.set('geometryType','esriGeometryPoint');
    params.set('inSR','4326');
    params.set('spatialRel','esriSpatialRelIntersects');
    params.set('resultRecordCount','5');
  } else if (mode === 'search') {
    const q=safeSearchTerm(values.q);
    if (q.length<2) throw new Error('Enter at least two address or APN characters.');
    const escaped=q.replace(/'/g,"''");
    // Only known column names and escaped literal string can enter a where clause.
    params.set('where', [
      "APN LIKE '%"+escaped+"%'",
      "APN_12 LIKE '%"+escaped+"%'",
      "FULLADDR LIKE '%"+escaped+"%'",
      "SITCITY LIKE '%"+escaped+"%'"
    ].join(' OR '));
  } else {
    throw new Error('Unsupported query mode.');
  }
  return params;
}

function send(res, status, body) {
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','public, s-maxage=60, max-age=30');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if(req.method !== 'GET') {
    res.setHeader('Allow','GET');
    return send(res,405,{error:'Only GET requests supported'});
  }
  let params;
  try {
    const u=new URL(req.url || '/', 'http://localhost');
    params=constructParcelQuery(u.searchParams.get('mode'),{
      lon:u.searchParams.get('lon'),lat:u.searchParams.get('lat'),q:u.searchParams.get('q')
    });
  } catch(e) {
    return send(res,400,{error:e.message});
  }
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),9000);
  try {
    const response=await fetch(UPSTREAM+'?'+params, {signal:controller.signal,headers:{Accept:'application/json'}});
    if(!response.ok) return send(res,502,{error:'County GIS returned HTTP '+response.status});
    const result=await response.json();
    if(result.error) return send(res,502,{error:'County GIS query returned an error'});
    if(result.type !== 'FeatureCollection' || !Array.isArray(result.features)) {
      return send(res,502,{error:'Unexpected county GIS response format'});
    }
    return send(res,200,result);
  } catch(e) {
    return send(res,502,{error:e?.name==='AbortError'?'County GIS timed out':'County GIS is temporarily unavailable'});
  } finally {
    clearTimeout(timeout);
  }
}

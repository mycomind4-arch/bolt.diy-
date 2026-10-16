/* Adapted from MIT licensed God’s Eye View by Bilawal Sidhu (2026).
   Upstream: https://github.com/bilawalsidhu/gods-eye-view
   Files: src/maps/imagery.js, src/maps/terrain.js.
   See THIRD_PARTY.md for upstream MIT notice and third-party data terms. */
import * as Cesium from 'cesium';

export const OSM_CREDIT = '© OpenStreetMap contributors';
export const ESRI_CREDIT = 'Powered by Esri — Esri, Maxar, Earthstar Geographics, and the GIS User Community';
export const KEYLESS_TERRAIN_URL='https://terrain.reearth.land/cesium-mesh/ellipsoid';
const COUNTY='https://cty-gis-web.co.humboldt.ca.us/server/rest/services';

export function createOsmImagery() {
  return new Cesium.OpenStreetMapImageryProvider({
    url:'https://tile.openstreetmap.org/',
    credit:OSM_CREDIT
  });
}
export function createEsriImagery() {
  return Cesium.ArcGisMapServerImageryProvider.fromUrl(
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
    {credit:ESRI_CREDIT,enablePickFeatures:false}
  );
}
export async function createKeylessTerrain() {
  // God’s Eye View approach: real public terrain first, flat fallback.
  try {
    return {
      provider:await Cesium.CesiumTerrainProvider.fromUrl(KEYLESS_TERRAIN_URL, {
        requestVertexNormals:true,
        requestWaterMask:false
      }),
      fallback:false
    };
  } catch(e) {
    console.warn('3D terrain unavailable: falling back to ellipsoid',e);
    return {provider:new Cesium.EllipsoidTerrainProvider(),fallback:true};
  }
}
export const OVERLAY_SOURCES={
  parcel:{label:'Parcel boundaries',url:COUNTY+'/Parcels/Parcels_no_labels/MapServer',alpha:.45},
  hazards:{label:'Hazard overlays',url:COUNTY+'/Web/Hazards_Pub2/MapServer',alpha:.62},
  coastal:{label:'Coastal zone',url:COUNTY+'/Web/Coastal_Zone/MapServer',alpha:.54}
};
export async function countyOverlay(id) {
  const source=OVERLAY_SOURCES[id];
  if(!source) throw new Error('Unknown overlay');
  return Cesium.ArcGisMapServerImageryProvider.fromUrl(source.url,{
    credit:'Humboldt County GIS — information only',
    enablePickFeatures:false
  });
}

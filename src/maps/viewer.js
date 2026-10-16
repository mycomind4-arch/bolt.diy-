import * as Cesium from 'cesium';
import {createOsmImagery,createEsriImagery,createKeylessTerrain,countyOverlay,OVERLAY_SOURCES} from './sources.js';
import {geometryExtent,inHumboldtBox} from '../data/parcels.js';

const INITIAL={lon:-124.10,lat:40.946,height:21000};
const HOME_PITCH=Cesium.Math.toRadians(-57);

export async function createAtlasViewer({onIdentify,onCoords,onViewStatus,onNotice}) {
  const viewer=new Cesium.Viewer('globe',{
    baseLayer:false,
    animation:false, timeline:false, geocoder:false, homeButton:false,
    sceneModePicker:false, baseLayerPicker:false, fullscreenButton:false,
    infoBox:false, selectionIndicator:false, navigationHelpButton:false,
    creditContainer:'map-credits',
    requestRenderMode:false,
    scene3DOnly:false,
    shouldAnimate:false
  });
  viewer.scene.backgroundColor=Cesium.Color.fromCssColorString('#080f14');
  viewer.scene.globe.baseColor=Cesium.Color.fromCssColorString('#102029');
  viewer.scene.globe.enableLighting=false;
  viewer.scene.globe.depthTestAgainstTerrain=false;
  viewer.scene.screenSpaceCameraController.minimumZoomDistance=20;
  viewer.scene.screenSpaceCameraController.maximumZoomDistance=360000;
  const overlayLayers=new Map();
  const pending=new Set();
  let basemapLayer=null,selectedDataSource=null,terrainActive=false;
  let basemapGeneration=0,selectedGeneration=0;

  async function basemap(mode) {
    const gen=++basemapGeneration;
    try {
      const provider=mode==='osm'?createOsmImagery():await createEsriImagery();
      if(gen!==basemapGeneration)return;
      const newLayer=viewer.imageryLayers.addImageryProvider(provider,0);
      if(basemapLayer)viewer.imageryLayers.remove(basemapLayer,true);
      basemapLayer=newLayer;
      onNotice?.(mode==='osm'?'OpenStreetMap base layer loaded':'Satellite imagery loaded','success');
    } catch(e) {
      if(gen!==basemapGeneration)return;
      if(mode!=='osm') {onNotice?.('Satellite unavailable; switching to streets','warning');return basemap('osm');}
      onNotice?.('Map imagery currently unavailable','error');
    }
  }

  async function overlay(id,enabled) {
    const existing=overlayLayers.get(id);
    if(!enabled) {
      pending.delete(id);
      if(existing) viewer.imageryLayers.remove(existing,true);
      overlayLayers.delete(id);
      return false;
    }
    if(existing)return true;
    if(pending.has(id))return false;
    pending.add(id);
    try {
      const provider=await countyOverlay(id);
      if(!pending.has(id))return false;
      const layer=viewer.imageryLayers.addImageryProvider(provider);
      layer.alpha=OVERLAY_SOURCES[id].alpha;
      overlayLayers.set(id,layer);
      return true;
    } catch(e) {
      onNotice?.('Could not load '+OVERLAY_SOURCES[id].label,'error');
      return false;
    } finally {
      pending.delete(id);
    }
  }

  async function terrain(enabled) {
    if(!enabled) {
      viewer.terrainProvider=new Cesium.EllipsoidTerrainProvider();
      terrainActive=false;
      onViewStatus?.('3D terrain off');
      return false;
    }
    onViewStatus?.('Loading 3D terrain…');
    const result=await createKeylessTerrain();
    viewer.terrainProvider=result.provider;
    terrainActive=!result.fallback;
    onViewStatus?.(terrainActive?'3D terrain on':'3D terrain unavailable');
    if(result.fallback)onNotice?.('Terrain provider unavailable; using flat globe','warning');
    return terrainActive;
  }

  async function highlight(feature,{fly=true}={}) {
    const gen=++selectedGeneration;
    if(selectedDataSource){
      viewer.dataSources.remove(selectedDataSource,true);
      selectedDataSource=null;
    }
    if(!feature?.geometry)return;
    try {
      const source=await Cesium.GeoJsonDataSource.load({
        type:'FeatureCollection',features:[feature]
      },{
        stroke:Cesium.Color.fromCssColorString('#76f5d2'),
        fill:Cesium.Color.fromCssColorString('#21d7b1').withAlpha(.21),
        strokeWidth:3,
        clampToGround:true
      });
      if(gen!==selectedGeneration){source.destroy();return;}
      for(const entity of source.entities.values){
        if(entity.polygon) {
          entity.polygon.outline=true;
          entity.polygon.outlineColor=Cesium.Color.fromCssColorString('#77ffe0');
          entity.polygon.material=Cesium.Color.fromCssColorString('#32f1c3').withAlpha(.28);
        }
      }
      await viewer.dataSources.add(source);
      if(gen!==selectedGeneration){viewer.dataSources.remove(source,true);return;}
      selectedDataSource=source;
      if(fly) {
        const e=geometryExtent(feature);
        if(e) {
          const pad=.0005;
          viewer.camera.flyTo({
            destination:Cesium.Rectangle.fromDegrees(e.west-pad,e.south-pad,e.east+pad,e.north+pad),
            duration:1.6
          });
        }
      }
    } catch(e){onNotice?.('Parcel loaded, but polygon highlight could not render','warning');}
  }

  function resetView() {
    viewer.scene.morphTo3D(.9);
    viewer.camera.flyTo({
      destination:Cesium.Cartesian3.fromDegrees(INITIAL.lon,INITIAL.lat,INITIAL.height),
      orientation:{heading:0,pitch:HOME_PITCH,roll:0},duration:1.3
    });
  }

  const handler=new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((event)=>{
    const ray=viewer.camera.getPickRay(event.position);
    const position=ray?viewer.scene.globe.pick(ray,viewer.scene):null;
    const point=position||viewer.camera.pickEllipsoid(event.position,viewer.scene.globe.ellipsoid);
    if(!point)return;
    const carto=Cesium.Cartographic.fromCartesian(point);
    const lon=Cesium.Math.toDegrees(carto.longitude),lat=Cesium.Math.toDegrees(carto.latitude);
    if(!inHumboldtBox(lon,lat)){
      onNotice?.('Atlas is limited to Humboldt County parcels. Use Reset to return.','warning');
      return;
    }
    onIdentify?.(lon,lat);
  },Cesium.ScreenSpaceEventType.LEFT_CLICK);
  let lastMouse=0;
  handler.setInputAction((event)=>{
    const now=Date.now();if(now-lastMouse<100)return;lastMouse=now;
    const ray=viewer.camera.getPickRay(event.endPosition);
    const point=ray?viewer.scene.globe.pick(ray,viewer.scene):null;
    if(!point)return;
    const c=Cesium.Cartographic.fromCartesian(point);
    onCoords?.(Cesium.Math.toDegrees(c.longitude),Cesium.Math.toDegrees(c.latitude));
  },Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  viewer.camera.changed.addEventListener(()=>{
    const h=viewer.camera.positionCartographic?.height||0;
    onViewStatus?.('Camera '+(h>=1000?(h/1000).toFixed(1)+' km':Math.round(h)+' m')+' • '+(terrainActive?'3D terrain':'ellipsoid'));
  });
  await basemap('satellite');
  resetView();
  return {
    viewer, basemap, overlay, terrain, highlight, resetView,
    switchMode(mode){return mode==='2d'?viewer.scene.morphTo2D(1):viewer.scene.morphTo3D(1);},
    clear(){return highlight(null,{fly:false});},
    destroy(){handler.destroy();viewer.destroy();}
  };
}

import {defineConfig} from 'vite';
import cesium from 'vite-plugin-cesium';
import gisHandler from './api/gis.js';
import intelligenceHandler from './api/intelligence.js';

/* Vite development and Vercel production share the same restricted parcel API.
   This avoids a misleading dev-only path or an open proxy. */
const gisDevelopmentMiddleware={
  name:'humboldt-atlas-gis',
  configureServer(server){
    server.middlewares.use((req,res,next)=>{
      const path=new URL(req.url||'/', 'http://localhost').pathname;
      const handler=path==='/api/gis'?gisHandler:path==='/api/intelligence'?intelligenceHandler:null;
      if(!handler)return next();
      Promise.resolve(handler(req,res)).catch(()=>{
        res.statusCode=502;
        res.setHeader('Content-Type','application/json');
        res.end(JSON.stringify({error:'County query unavailable'}));
      });
    });
  }
};

export default defineConfig({
  plugins:[gisDevelopmentMiddleware,cesium()],
  server:{host:'0.0.0.0'}
});

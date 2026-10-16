import {defineConfig} from 'vite';
import cesium from 'vite-plugin-cesium';
import gisHandler from './api/gis.js';

/* Vite development and Vercel production share the same restricted parcel API.
   This avoids a misleading dev-only path or an open proxy. */
const gisDevelopmentMiddleware={
  name:'humboldt-atlas-gis',
  configureServer(server){
    server.middlewares.use((req,res,next)=>{
      if(!req.url?.startsWith('/api/gis'))return next();
      Promise.resolve(gisHandler(req,res)).catch(()=>{
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

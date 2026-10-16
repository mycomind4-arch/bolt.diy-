# Humboldt Atlas
### 3D parcel intelligence — Humboldt County, California

**Humboldt Atlas** is a county-scoped, source-linked 3D map and parcel research application. Its primary parcel data source is the **official Humboldt County ArcGIS REST feature layer**:

https://cty-gis-web.co.humboldt.ca.us/server/rest/services/Parcels/Parcels/MapServer/0

Users can select polygons by map click, look up real addresses or APNs, and inspect GIS-provided parcel attributes. The app intentionally does **not** invent building permit, code enforcement, sewer hookup, legal-title or resident-profile records when those records have not been retrieved.

### Features
- Full-screen Cesium 3D map centered on McKinleyville with satellite/OSM switch, keyless 3D relief, 2D switch, zoom/pan and county view reset.
- County parcel click identification and APN/address search against live official ArcGIS REST GeoJSON endpoint, including outlines and fly-to highlighting.
- Official county imagery overlays: parcel boundaries, hazards, coastal zone. Credits and service failure states.
- Searchable right-side dossier: parcel attributes, zoning/land use, hazard indicators, permits, code enforcement, utilities/MCSD, historical parcel identifiers and full sources. Unknown values are never fabricated.
- Official Accela/MCSD/Planning/Assessor link-outs, downloadable selected feature GeoJSON, shareable APN deep links, and an unsent/copyable California Public Records Act request draft.
- Responsive mobile bottom sheet.
- Restricted, read-only server proxy with input validation and request timeout, used if direct county GIS browser requests are blocked by CORS.

### Repository origin and code reuse
This was built in a previously empty, unused GitHub repository. The Cesium imagery and terrain provider patterns and code in `src/maps/sources.js` are **adapted from the MIT-licensed [God’s Eye View](https://github.com/bilawalsidhu/gods-eye-view)** by Bilawal Sidhu. Full notices: [THIRD_PARTY.md](./THIRD_PARTY.md). The aerial imagery, public GIS datasets, and terrain service have separate licensing and usage rules; they are **not** made MIT by the upstream software license.

### Run
Requires Node.js 20+ (Node 22 recommended).

```bash
npm install
npm run dev
```

Open the Vite-provided local URL. For production:

```bash
npm test
npm run build
```

### Deploy
This is a Vite app with a Vercel function at `api/gis.js`. Import this repository into Vercel with framework preset **Vite**, build command `npm run build`, output directory `dist`. The `api/gis.js` route proxies county **parcel queries only**, not arbitrary websites. The same handler works in development through Vite middleware. **Not published automatically**; connect a deployment target to make it live.

The app uses keyless Esri imagery and OpenStreetMap fallback, plus Re:Earth terrain with ellipsoid fallback. No Google Photorealistic 3D imagery is enabled, and no credentials are stored. Esri, OSM, Re:Earth, and Humboldt data services can rate limit, change, or have separate use terms. Production operators should review these terms and traffic ceilings.

### API / provenance
- Parcel GIS: https://cty-gis-web.co.humboldt.ca.us/server/rest/services/Parcels/Parcels/MapServer/0
- County GIS catalog: https://humboldtgov.org/GIS
- Official GIS datasets: https://humboldtgov.org/276/GIS-Data-Download
- Planning/permit public search: https://aca-prod.accela.com/humboldt/default.aspx
- Public record / building inspection: https://humboldtgov.org/153/Building-Inspection
- Water/sewer district context: https://www.mckinleyvillecsd.ca.gov/
- County hazard GIS: https://cty-gis-web.co.humboldt.ca.us/server/rest/services/Web/Hazards_Pub2/MapServer
- Coastal zone GIS: https://cty-gis-web.co.humboldt.ca.us/server/rest/services/Web/Coastal_Zone/MapServer

**Critical caveat:** official county GIS warns these parcel polygons should not be used for survey, precise boundaries, legal determinations or as definitive current zoning. GIS parcel data does not establish ownership or the existence/absence of code enforcement actions or permits. Other agencies (Eureka, Arcata, Trinidad and other jurisdictions) may hold additional records.

### Roadmap
1. Independent automated checks against live API schemas and field availability, plus rate-limit and offline handling.
2. Parcel-linked, verified permit/enforcement **read-only** integrations if public APIs and agency permissions allow; otherwise preserve explicit unverified status and official search links.
3. Fire, tsunami, flood, slope and jurisdiction-aware spatial intersections with evidence provenance and layer-date labels.
4. Official parcel shapefile offline indexing (PostGIS) for high-volume search with synchronized update logs.
5. Building footprints / optional photorealistic 3D only with appropriately licensed providers.

### Privacy & security
Uses official public parcel data only; no private-data scraping or resident profile aggregation. Records requests are draft-only and require manual user action. The proxy enforces a single county host, bounded location searches, allowlisted fields, and a timeout. Do not add client-side API secrets.

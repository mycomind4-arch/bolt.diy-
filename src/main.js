import 'cesium/Build/Cesium/Widgets/widgets.css';
import './style.css';
import {createAtlasViewer} from './maps/viewer.js';
import {
  identifyParcel,findParcels,parcelProps,apn,parcelAddress,fmtAcres,
  dateValue,missing,parcelCenter,PARCEL_LAYER,ACCELA,MCSD,COUNTY_GIS,
  COUNTY_DOWNLOAD,FIELDS
} from './data/parcels.js';

const COUNTY_ACCOUNTS='https://humboldtgov.org/153/Building-Inspection';
const PDR='https://humboldtgov.org/1305/Planning-Building';
const E=e=>document.querySelector(e);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const href=(url,label,cls='')=>`<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;

let atlas=null,feature=null,activeTab='parcel',searchController=null,identifyController=null,searchDelay=null,toastTimer=null;
let searchResults=[];
const base='https://cty-gis-web.co.humboldt.ca.us/server/rest/services';
const dataLinks=[
  ['Parcel attributes / polygons',PARCEL_LAYER],
  ['County GIS viewer',COUNTY_GIS],
  ['Official county data downloads',COUNTY_DOWNLOAD],
  ['Parcel boundary overlay',base+'/Parcels/Parcels_no_labels/MapServer'],
  ['Hazards service',base+'/Web/Hazards_Pub2/MapServer'],
  ['Coastal zone service',base+'/Web/Coastal_Zone/MapServer'],
  ['Accela permits / planning / public search',ACCELA],
  ['Planning & Building Department',PDR],
  ['Building Inspection',COUNTY_ACCOUNTS],
  ['McKinleyville Community Services District',MCSD],
  ['God’s Eye View — MIT upstream', 'https://github.com/bilawalsidhu/gods-eye-view']
];

E('#app').innerHTML=`
  <div class="application">
    <section class="map-area" aria-label="Interactive Humboldt County 3D map">
      <div id="globe" aria-label="Interactive globe"></div>
      <div class="map-vignette"></div>
      <header class="topbar">
        <div class="brand"><div class="brand-mark"><span>H</span><i></i></div>
          <div><div class="eyebrow brand-overline">GEOSPATIAL PROPERTY INTELLIGENCE</div>
            <div class="brand-name">HUMBOLDT <em>ATLAS</em></div></div>
        </div>
        <div class="topbar-right">
          <span class="region">CALIFORNIA <b>/</b> HUMBOLDT COUNTY</span>
          <div class="live-indicator"><i></i> OFFICIAL GIS <small id="gis-state">READY</small></div>
        </div>
      </header>
      <div class="search-position">
        <div class="search-box">
          <svg viewBox="0 0 24 24" aria-hidden="true" width="19" height="19"><circle cx="10.7" cy="10.7" r="6.7" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 5 5" stroke="currentColor" stroke-width="1.8"/></svg>
          <input id="search" type="search" autocomplete="off" spellcheck="false" placeholder="Search street address, APN, or town…" aria-label="Search Humboldt parcels" />
          <kbd>↵</kbd>
          <button class="search-go" id="search-go" aria-label="Search parcels">SEARCH</button>
        </div>
        <div id="search-results" class="search-results hidden" role="listbox" aria-label="Parcel search results"></div>
        <div class="hint">Search the live county parcel index or click a parcel on the map</div>
      </div>
      <aside class="controls" aria-label="Map layers and controls">
        <div class="panel-title"><span class="signal-lines">≋</span> EXPLORER <span class="panel-index">01 / 03</span></div>
        <div class="section-kicker">BASE IMAGERY</div>
        <div class="mode-toggle" role="group" aria-label="Map style">
          <button id="satellite" class="selected" aria-pressed="true">◈ Satellite</button>
          <button id="streets" aria-pressed="false">▦ Streets</button>
        </div>
        <div class="section-kicker layer-title">GIS OVERLAYS</div>
        <label class="layer-row"><span class="layer-icon cyan">▱</span><span>Parcels<small>Boundary outlines</small></span><input id="layer-parcel" type="checkbox"><i class="switch"></i></label>
        <label class="layer-row"><span class="layer-icon gold">◉</span><span>Hazard zones<small>County hazard layers</small></span><input id="layer-hazards" type="checkbox"><i class="switch"></i></label>
        <label class="layer-row"><span class="layer-icon blue">≈</span><span>Coastal zone<small>Planning boundary</small></span><input id="layer-coastal" type="checkbox"><i class="switch"></i></label>
        <div class="section-kicker layer-title">VIEW CONTROLS</div>
        <div class="view-grid">
          <button id="mode-3d" class="view-button selected">▱ <b>3D</b></button>
          <button id="mode-2d" class="view-button">▤ <b>2D</b></button>
        </div>
        <label class="layer-row terrain-control"><span class="layer-icon green">△</span><span>Terrain relief<small>Keyless elevation tiles</small></span><input id="terrain" type="checkbox"><i class="switch"></i></label>
        <button class="outline-button reset" id="reset">◎ RESET HUMBOLDT VIEW <span>↗</span></button>
        <div class="control-footer">MAP DATA © HUMBOLDT COUNTY GIS<br><span>Planning use only. Not a legal survey.</span></div>
      </aside>
      <div class="map-crosshair" aria-hidden="true"><i></i><i></i></div>
      <div class="map-hint"><span class="dot"></span> SELECT A PARCEL FOR INTELLIGENCE</div>
      <div class="zoom-caption">HUMBOLDT COUNTY · CA <span>40.946° N, 124.10° W</span></div>
      <footer class="statusbar"><span>◈ HUMBOLDT ATLAS <i>·</i> v0.1</span>
        <span id="coordinates">CURSOR --.------°  --.------°</span>
        <span id="view-status">INITIALIZING 3D MAP…</span>
        <span>WGS 84 <b>·</b> GIS NOT A SURVEY</span>
      </footer>
      <div id="map-credits" class="map-credits"></div>
    </section>
    <aside class="dossier" id="dossier" aria-label="Parcel intelligence dossier">
      <div class="dossier-topline"><span>PROPERTY INTELLIGENCE</span><span class="dossier-badge">DOSSIER / 001</span></div>
      <div id="dossier-content"></div>
      <div class="dossier-sticky">
        <button id="request-records" class="primary-button">✚  DRAFT RECORDS REQUEST <span>↗</span></button>
        <div class="private-note">PUBLIC RECORDS · SOURCE-VERIFIED · NO PEOPLE PROFILING</div>
      </div>
    </aside>
    <button id="mobile-dossier" class="mobile-dossier">≡  PROPERTY DOSSIER</button>
  </div>
  <div id="toast" role="status" aria-live="polite" class="toast hidden"></div>
  <dialog id="request-dialog" class="request-dialog" aria-labelledby="request-title">
    <form method="dialog" class="request-wrap">
      <div class="request-header"><span class="eyebrow">PUBLIC RECORDS</span><button value="cancel" class="close-modal" aria-label="Close dialog">✕</button></div>
      <h2 id="request-title">Draft a records request</h2>
      <p>Creates a copyable draft. Nothing is sent, and no contact information is collected.</p>
      <label class="form-label" for="agency">Public agency</label>
      <select id="agency">
        <option value="planning">Humboldt County Planning &amp; Building</option>
        <option value="mcsd">McKinleyville Community Services District</option>
        <option value="assessor">Humboldt County Assessor / Recorder</option>
      </select>
      <label class="form-label" for="draft">Request text</label>
      <textarea id="draft" spellcheck="true" rows="13"></textarea>
      <div class="dialog-actions"><button type="button" class="outline-button" id="copy-draft">COPY DRAFT</button><button class="primary-button" value="cancel">CLOSE</button></div>
    </form>
  </dialog>
`;

const contentBox=E('#dossier-content');
const status=E('#gis-state');
const messages={
  empty:'The map is ready. Search by address or assessor parcel number, or click a mapped property to inspect the official county GIS attributes.',
  noResult:'The county layer returned no parcel at that location. This does not establish that the property or records do not exist.'
};

function notice(text,type='info'){
  const node=E('#toast');node.className='toast '+type;node.textContent=text;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.className='toast hidden',4400);
}
function setGIS(text){status.textContent=text;}
function blankDossier(){
  contentBox.innerHTML=`
  <div class="empty-state">
    <div class="radar-art"><i class="circle-1"></i><i class="circle-2"></i><i class="circle-3"></i><span>⌖</span></div>
    <div class="eyebrow accent">AWAITING SELECTION</div>
    <h1>Every property<br>has a <em>story.</em></h1>
    <p>${messages.empty}</p>
    <div class="empty-divider"></div>
    <div class="empty-stat"><span>01</span><div>EXPLORE THE TERRAIN<small>Satellite imagery + 3D elevation</small></div></div>
    <div class="empty-stat"><span>02</span><div>SELECT AN ACTUAL PARCEL<small>County GIS parcel geometry &amp; APN</small></div></div>
    <div class="empty-stat"><span>03</span><div>TRACE THE PUBLIC RECORD<small>Planning, hazards, permits &amp; source links</small></div></div>
  </div>`;
}
blankDossier();

function row(label,value,unit=null){
  const v=unit==='acres'?fmtAcres(value):unit==='date'?dateValue(value):missing(value);
  const known=v!=='Not available';
  return `<div class="data-row"><span>${esc(label)}</span><strong class="${known?'':'unknown'}">${esc(v)}</strong></div>`;
}
function fields(keys,p){return keys.map(([label,key,unit])=>row(label,p[key],unit)).join('');}
function sourceNote(url=PARCEL_LAYER){
  return `<div class="field-source">◈ SOURCE: ${href(url,'Humboldt County GIS')}<br><small>GIS data may be incomplete or inaccurate; verify with the responsible agency.</small></div>`;
}
function verifyCard(title,body,url,cta){
  return `<div class="verify-card"><div class="verify-status">◉ NOT INDEPENDENTLY VERIFIED</div><h3>${esc(title)}</h3><p>${esc(body)}</p>${href(url,cta,'source-button')}</div>`;
}
function tabView(tab,p){
  switch(tab) {
    case 'parcel': return `
      <div class="section-subtitle">OFFICIAL GIS ATTRIBUTE RECORD</div>
      <div class="data-grid">${fields(FIELDS.parcel,p)}</div>
      <div class="disclaimer"><b>Boundary and legal accuracy:</b> County polygons are for planning and visualization, not surveying, ownership proof or legal boundary determination.</div>${sourceNote()}`;
    case 'zoning': return `
      <div class="section-subtitle">PLANNING &amp; LAND USE</div>
      <div class="data-grid">${fields(FIELDS.zoning,p)}</div>
      <div class="disclaimer">GIS zoning values are informational. Verify the effective zoning and any overlays with the Planning &amp; Building Department before relying on them.</div>${href(PDR,'Planning & Building Department','source-button')}${sourceNote()}`;
    case 'hazards': return `
      <div class="section-subtitle">ENVIRONMENTAL &amp; HAZARD ATTRIBUTES</div>
      <div class="data-grid">${fields(FIELDS.hazards,p)}</div>
      <div class="disclaimer">An empty indicator does not establish absence of hazard risk. Use the county hazard service; mapped hazard data can be dated or incomplete.</div>
      ${href(base+'/Web/Hazards_Pub2/MapServer','County hazard overlays','source-button')}${sourceNote(base+'/Web/Hazards_Pub2/MapServer')}`;
    case 'permits': return `
      ${verifyCard('Building & planning permits','A public API with parcel-linked permit results is not integrated. Search the official Accela portal using the APN or property address. No missing result is treated as proof of no permit.',ACCELA,'SEARCH OFFICIAL PERMIT RECORDS')}
      ${verifyCard('Inspections & violations','Building inspections and enforcement history must be checked separately with the responsible jurisdiction. GIS parcel attributes alone do not contain a verified case history.',COUNTY_ACCOUNTS,'BUILDING INSPECTION DEPARTMENT')}
      <div class="disclaimer">A parcel may fall within city limits; some permits and violations may be held by the city rather than the county.</div>`;
    case 'enforcement': return `
      ${verifyCard('Code enforcement case history','No verified enforcement cases have been retrieved for this parcel. This means the records have not been searched, NOT that zero violations exist.',ACCELA,'SEARCH OFFICIAL ACCELA PORTAL')}
      <div class="action-list">
        <div><b>Useful record categories</b><small>Complaints and case numbers • notices of violation • inspection reports • notices and proof of service • abatement and demolition orders • warrant applications • hearing and appeal documents • cost recovery and liens</small></div>
      </div><button class="secondary-inline" data-request="true">CREATE A RECORDS REQUEST DRAFT ↗</button>`;
    case 'utilities': return `
      <div class="section-subtitle">UTILITY DISTRICT / WATER / SEWER</div>
      <div class="data-grid">${row('MCSD GIS field',p.MCSD)}${row('Sewer service status',null)}${row('Water service status',null)}${row('Connection / hookup records',null)}${row('Utility easements',null)}</div>
      <div class="disclaimer">The MCSD field is a GIS attribute, not confirmation of water or sewer availability, service connections, permits, accounts, easements or capacity.</div>
      ${verifyCard('Verify with McKinleyville CSD','Request available service-area, meter, sewer lateral, connection, utility permit and infrastructure records directly from MCSD.',MCSD,'OPEN MCSD WEBSITE')}`;
    case 'history': return `
      <div class="section-subtitle">HISTORICAL IDENTIFIERS</div>
      <div class="data-grid">${row('Previous APN',p.OLDAPN)}${row('Book / page',p.BKPG)}${row('GIS transfer date',p.TRANDATE,'date')}${row('Tax rate area',p.TRA)}${row('Legal description excerpt',p.LEGAL)}</div>
      <div class="disclaimer">A GIS transfer-date value is not proof of a deed, current title, beneficial ownership, inheritance, liens, court orders, or legal chain of title.</div>
      ${verifyCard('Official recorded instruments','Recorded deeds, easements, liens, title transfers, court judgments, and older historical documents need separate searches or records requests.',COUNTY_DOWNLOAD,'OPEN COUNTY GIS DATA CATALOG')}`;
    case 'sources': return `
      <div class="section-subtitle">SOURCE PROVENANCE</div><div class="source-list">${dataLinks.map(([label,url])=>`<div class="source-item"><div class="source-dot">◈</div><div><b>${esc(label)}</b><small>${esc(url)}</small></div>${href(url,'↗')}</div>`).join('')}</div>
      <div class="disclaimer">This application does not retrieve private utility accounts, personal profiles, non-public enforcement files, or deeds. External sources are not automatically joined to parcels without verified linking identifiers.</div>`;
    default: return '';
  }
}

function renderDossier(){
  if(!feature){blankDossier();return;}
  const p=parcelProps(feature);
  const tabs=[
    ['parcel','OVERVIEW'],['zoning','ZONING'],['hazards','HAZARDS'],
    ['permits','PERMITS'],['enforcement','ENFORCEMENT'],['utilities','UTILITIES'],
    ['history','HISTORY'],['sources','SOURCES']
  ];
  const name=p.FULLADDR||'Unnamed / unsited parcel';
  contentBox.innerHTML=`
    <div class="parcel-header">
      <div class="eyebrow accent">SELECTED PARCEL <span class="geo-icon">⌖</span></div>
      <h1>${esc(name)}</h1>
      <p>${esc([p.SITCITY,p.SITZIP].filter(Boolean).join(' · ')||'Humboldt County, California')}</p>
      <div class="parcel-tags"><span>APN ${esc(apn(feature)||'UNAVAILABLE')}</span><span>GIS RECORD</span></div>
      <div class="metrics">
        <div><small>GIS AREA</small><b>${esc(fmtAcres(p.ACRES))}</b></div>
        <div><small>ZONING</small><b>${esc(missing(p.ZONING))}</b></div>
        <div><small>JURISDICTION</small><b>${esc(missing(p.JURIS))}</b></div>
      </div>
      <div class="parcel-actions">
        <button id="fly-parcel">⌖ LOCATE</button><button id="copy-link">↗ SHARE</button><button id="download-json">↓ EXPORT GEOJSON</button>
      </div>
    </div>
    <div class="dossier-tabs" role="tablist" aria-label="Property data categories">${tabs.map(([id,label])=>`<button role="tab" data-tab="${id}" class="${activeTab===id?'active':''}" aria-selected="${activeTab===id}">${label}</button>`).join('')}</div>
    <div class="dossier-body"><div class="section-heading"><i></i>${esc(tabs.find(x=>x[0]===activeTab)?.[1])}<span>COUNTY / VERIFIED SOURCE</span></div>${tabView(activeTab,p)}</div>
  `;
  contentBox.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{
    activeTab=btn.dataset.tab;renderDossier();
  }));
  E('#fly-parcel')?.addEventListener('click',()=>atlas?.highlight(feature,{fly:true}));
  E('#copy-link')?.addEventListener('click',async()=>{
    const url=new URL(location.href);
    if(apn(feature))url.searchParams.set('apn',apn(feature));
    try{await navigator.clipboard.writeText(url.toString());notice('Property link copied','success');}
    catch{notice('Could not copy link; browser permission required','warning');}
  });
  E('#download-json')?.addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(feature,null,2)],{type:'application/geo+json'});
    const address=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=address;a.download='humboldt-parcel-'+(apn(feature)||'selection')+'.geojson';a.click();
    setTimeout(()=>URL.revokeObjectURL(address),500);
  });
  contentBox.querySelectorAll('[data-request]').forEach(btn=>btn.addEventListener('click',showRequest));
}

async function selectParcel(chosen,{fly=true}={}){
  if(!chosen)return;
  feature=chosen;activeTab='parcel';renderDossier();
  E('#search-results').classList.add('hidden');
  E('#dossier').classList.add('mobile-open');
  if(atlas)await atlas.highlight(chosen,{fly});
  setGIS('LIVE');
}
function formatResult(item){
  return `<b>${esc(parcelProps(item).FULLADDR||apn(item)||'Unaddressed parcel')}</b><small>APN ${esc(apn(item)||'N/A')} · ${esc(parcelProps(item).SITCITY||'Humboldt County')} · ${esc(fmtAcres(parcelProps(item).ACRES))}</small>`;
}
async function doSearch(q){
  const term=q.trim();
  if(searchController)searchController.abort();
  searchController=new AbortController();
  const results=E('#search-results');
  if(term.length<2){results.classList.add('hidden');return;}
  results.classList.remove('hidden');
  results.innerHTML='<div class="search-message">QUERYING OFFICIAL HUMBOLDT COUNTY GIS…</div>';
  setGIS('QUERYING');
  try{
    const matches=await findParcels(term,searchController.signal);
    if(searchController.signal.aborted)return;
    searchResults=matches;
    if(!matches.length){results.innerHTML='<div class="search-message">No matching county GIS parcels. Try a complete APN or another address format.</div>';setGIS('READY');return;}
    results.innerHTML=`<div class="search-results-label">${matches.length} LIVE GIS MATCH${matches.length!==1?'ES':''}</div>`+
      matches.map((f,i)=>`<button class="result" data-result="${i}"><span>⌖</span><div>${formatResult(f)}</div><i>↗</i></button>`).join('');
    results.querySelectorAll('[data-result]').forEach(btn=>btn.addEventListener('click',()=>selectParcel(searchResults[Number(btn.dataset.result)])));
    setGIS('LIVE');
  }catch(e){
    if(searchController.signal.aborted)return;
    results.innerHTML=`<div class="search-message error">County GIS request failed. ${esc(e.message)}<br>Try again or open the official source.</div>`;
    setGIS('OFFLINE');
  }
}
async function identify(lon,lat){
  identifyController?.abort();
  identifyController=new AbortController();
  setGIS('IDENTIFYING');
  try{
    const results=await identifyParcel(lon,lat,identifyController.signal);
    if(identifyController.signal.aborted)return;
    if(results.length)await selectParcel(results[0],{fly:false});
    else{notice(messages.noResult,'warning');setGIS('READY');}
  } catch(e) {
    if(identifyController.signal.aborted)return;
    notice('County GIS identify unavailable: '+e.message,'error');setGIS('OFFLINE');
  }
}

const searchInput=E('#search');
searchInput.addEventListener('input',()=>{
  clearTimeout(searchDelay);
  searchDelay=setTimeout(()=>doSearch(searchInput.value),350);
});
searchInput.addEventListener('keydown',event=>{
  if(event.key==='Enter'){event.preventDefault();clearTimeout(searchDelay);doSearch(searchInput.value);}
  if(event.key==='Escape')E('#search-results').classList.add('hidden');
});
E('#search-go').addEventListener('click',()=>{clearTimeout(searchDelay);doSearch(searchInput.value);});
document.addEventListener('pointerdown',event=>{
  if(!event.target.closest('.search-position'))E('#search-results').classList.add('hidden');
});
E('#mobile-dossier').addEventListener('click',()=>E('#dossier').classList.toggle('mobile-open'));
E('#reset').addEventListener('click',()=>atlas?.resetView());

for(const id of ['parcel','hazards','coastal']){
  E('#layer-'+id).addEventListener('change',async event=>{
    const box=event.currentTarget;
    box.disabled=true;
    try{
      const ok=await atlas?.overlay(id,box.checked);
      if(box.checked&&!ok)box.checked=false;
      else notice(box.checked?id+' overlay loaded':id+' overlay disabled',box.checked?'success':'info');
    } finally {box.disabled=false;}
  });
}
E('#terrain').addEventListener('change',async event=>{
  const box=event.currentTarget;box.disabled=true;
  try{const ok=await atlas?.terrain(box.checked);if(box.checked&&!ok)box.checked=false;}
  finally {box.disabled=false;}
});

function bindToggle(id1,id2,fn){
  const a=E('#'+id1),b=E('#'+id2);
  a.addEventListener('click',async()=>{
    a.classList.add('selected');b.classList.remove('selected');
    a.setAttribute('aria-pressed','true');b.setAttribute('aria-pressed','false');
    await fn(true);
  });
  b.addEventListener('click',async()=>{
    b.classList.add('selected');a.classList.remove('selected');
    b.setAttribute('aria-pressed','true');a.setAttribute('aria-pressed','false');
    await fn(false);
  });
}
bindToggle('satellite','streets',first=>atlas?.basemap(first?'satellite':'osm'));
bindToggle('mode-3d','mode-2d',first=>atlas?.switchMode(first?'3d':'2d'));

function buildRequest(){
  const p=parcelProps(feature);
  const agency=E('#agency').value;
  const recipient={planning:'Humboldt County Planning & Building Department',mcsd:'McKinleyville Community Services District',assessor:'Humboldt County Assessor / Recorder'}[agency];
  const marker=feature?`Assessor parcel number: ${missing(apn(feature))}\nProperty address: ${missing(parcelAddress(feature))}`:'Parcel/APN: [INSERT APN OR ADDRESS]';
  const request=agency==='planning'
    ?'Please provide all reasonably identifiable public records concerning this property, including planning and building applications, submitted plans, permits and approvals, inspections, code enforcement complaints/case logs, photographs, correspondence, notices of violation, abatements, demolition actions, warrants, hearings, appeals, cost assessments, liens and proof of service.'
    :agency==='mcsd'
    ?'Please provide all reasonably identifiable available public records concerning water and sewer service to this property, including service-area determinations, main/lateral infrastructure drawings, connection applications, hookup permits, capacity letters, inspections, connection history, and public easement or encroachment records. Please omit account-holder private financial or personal information.'
    :'Please provide reasonably identifiable public parcel identification, assessment-map, recorded-document index, publicly available parcel-history and GIS reference records for this property, and advise which agency maintains official deeds, easements and chain-of-title instruments.';
  E('#draft').value=`To: ${recipient}\nRe: California Public Records Act request\n\n${marker}\n\nUnder the California Public Records Act, I request copies of the following existing public records:\n\n${request}\n\nPlease provide electronic copies where available, identify any reasonably segregable nonexempt portions of withheld records, and advise if you do not maintain these records or if another agency does. Please provide an estimate of any lawful copying fees before incurring them.\n\nThis request is for existing records, not a request for the agency to create new records.\n\nSincerely,\n[YOUR NAME]\n[CONTACT EMAIL OR MAILING ADDRESS]`;
}
function showRequest(){
  buildRequest();E('#request-dialog').showModal();
}
E('#request-records').addEventListener('click',showRequest);
E('#agency').addEventListener('change',buildRequest);
E('#copy-draft').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(E('#draft').value);notice('Public records request draft copied','success');}
  catch{E('#draft').focus();E('#draft').select();notice('Select the draft and copy it manually','warning');}
});

async function start(){
  try {
    atlas=await createAtlasViewer({
      onIdentify:identify,
      onCoords:(lon,lat)=>{E('#coordinates').textContent=`CURSOR ${lat.toFixed(5)}° N  ${Math.abs(lon).toFixed(5)}° W`;},
      onViewStatus:message=>{E('#view-status').textContent=message.toUpperCase();},
      onNotice:notice
    });
    setGIS('LIVE');
    // Start with county parcel boundaries off for fast mobile load; users can opt in.
    const url=new URL(location.href);
    if(url.searchParams.has('apn')) {
      const query=url.searchParams.get('apn')?.slice(0,70)||'';
      if(query.length>1){
        searchInput.value=query;
        const results=await findParcels(query);
        const exact=results.find(x=>apn(x)===query)||results[0];
        if(exact)await selectParcel(exact);
      }
    }
  } catch(e) {
    console.error('Map initialization failed',e);
    setGIS('MAP ERROR');
    notice('Could not initialize 3D map: '+e.message,'error');
    E('#globe').innerHTML='<div class="map-error">Map could not load. Reload the page, or search official Humboldt County GIS directly.</div>';
  }
}
start();

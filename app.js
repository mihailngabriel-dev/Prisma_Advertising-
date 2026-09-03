let currentFilter='all';
let query='';
let selected=new Set(JSON.parse(localStorage.getItem('prismaSelected')||'[]'));
let currentView='list';
let map=null, markerLayer=null;
const markerIndex=new Map();
const grid=document.getElementById('locationGrid');
const count=document.getElementById('selectionCount');
const drawer=document.getElementById('drawer'), drawerBackdrop=document.getElementById('drawerBackdrop');
const modal=document.getElementById('detailModal'), modalBackdrop=document.getElementById('modalBackdrop');
const eur=n=>new Intl.NumberFormat('ro-RO',{maximumFractionDigits:2}).format(n)+' EUR';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

// Coordonate pentru punctele din portofoliu. Când sursa oferă GPS, folosim acel punct;
// pentru locațiile cu mai multe formate în aceeași incintă folosim punctul comun al locației.
const siteCoords={
  'bratianu':{lat:44.42668,lng:26.10493,q:'exact'},
  'buzesti':{lat:44.44791,lng:26.08220,q:'venue'},
  'dn1-stanga':{lat:44.5842223,lng:26.0704926,q:'exact'},
  'dn1-dreapta':{lat:44.5970857,lng:26.0712572,q:'exact'},
  'otopeni-unipol':{lat:44.5384039,lng:26.0683982,q:'exact'},
  'gara-constanta':{lat:44.16806,lng:28.63332,q:'exact'},
  'winmarkt-bistrita-1':{lat:47.13225,lng:24.48693,q:'exact'},
  'winmarkt-bistrita-2':{lat:47.13225,lng:24.48693,q:'exact'},
  'winmarkt-braila-1':{lat:45.2719014,lng:27.9671592,q:'exact'},
  'winmarkt-braila-2':{lat:45.2719014,lng:27.9671592,q:'exact'},
  'winmarkt-buzau-1':{lat:45.1531944,lng:26.8218956,q:'exact'},
  'winmarkt-buzau-2':{lat:45.1531944,lng:26.8218956,q:'exact'},
  'winmarkt-ploiesti-led':{lat:44.94115,lng:26.02090,q:'exact'},
  'winmarkt-ploiesti-parking':{lat:44.94115,lng:26.02090,q:'venue'},
  'winmarkt-ramnicu-1':{lat:45.10244,lng:24.36267,q:'exact'},
  'winmarkt-ramnicu-2':{lat:45.10244,lng:24.36267,q:'exact'},
  'winmarkt-vaslui':{lat:46.640406,lng:27.7335906,q:'exact'}
};
function resolveCoords(x){
  if(siteCoords[x.id]) return siteCoords[x.id];
  if(x.group==='Sinaia'){
    if(x.area.includes('Cota 1000')) return {lat:45.34919,lng:25.53367,q:'exact'};
    if(x.area.includes('Cota 1400')) return {lat:45.35478,lng:25.51814,q:'exact'};
    if(x.area.includes('Cota 2000')) return {lat:45.359584,lng:25.495561,q:'exact'};
    if(x.area.includes('Valea Soarelui')) return {lat:45.3661,lng:25.4737,q:'venue'};
    return {lat:45.3504,lng:25.5510,q:'venue'};
  }
  if(x.group==='Transalpina'){
    if(x.area.includes('1830')) return {lat:45.4151,lng:23.6974,q:'venue'};
    if(x.area.includes('2000')) return {lat:45.4119,lng:23.6902,q:'venue'};
    return {lat:45.41718,lng:23.70497,q:'exact'};
  }
  return null;
}
function groups(){return [...new Set(locations.map(x=>x.group))]}
function renderFilters(){
 const box=document.getElementById('filters');
 box.innerHTML=[['all','Toate'],...groups().map(g=>[g,g])].map(([v,l])=>`<button class="filter ${currentFilter===v?'active':''}" data-filter="${esc(v)}">${esc(l)}</button>`).join('');
 box.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{currentFilter=b.dataset.filter;renderFilters();renderCards();renderMapMarkers()}));
}
function filtered(){
 const q=query.toLowerCase().trim();
 return locations.filter(x=>(currentFilter==='all'||x.group===currentFilter)&&(!q||[x.name,x.area,x.address,x.meta1,x.meta2].join(' ').toLowerCase().includes(q)));
}
function renderCards(){
 const items=filtered();
 document.getElementById('inventoryCount').textContent=`${items.length} ${items.length===1?'locație':'locații'}`;
 grid.innerHTML=items.length?items.map(x=>`<article class="card group-${x.group.toLowerCase().replace(/[^a-z0-9]+/g,'-')}">
  <div class="card-media"><img loading="lazy" src="${x.image}" alt="${esc(x.name)}"><span class="area-tag">${esc(x.area)}</span></div>
  <div class="card-body"><div class="card-title-row"><h3>${esc(x.name)}</h3><div class="price-wrap"><div class="price">${esc(x.priceLabel)}</div><div class="price-note">* Producția, decorarea/neutralizarea fac obiectul unei negocieri separate.</div></div></div>
  <div class="meta"><div><span>${esc(x.meta1Label)}</span><strong>${esc(x.meta1)}</strong></div><div><span>${esc(x.meta2Label)}</span><strong>${esc(x.meta2)}</strong></div></div>
  <div class="address">${esc(x.address)}</div>
  <div class="card-actions"><button class="ghost" data-map-id="${x.id}">Pe hartă</button><button class="ghost" onclick="openDetails('${x.id}')">Detalii</button><button class="primary ${selected.has(x.id)?'selected':''}" onclick="toggleSelect('${x.id}')">${selected.has(x.id)?'✓ Selectat':'Adaugă în selecție'}</button></div></div></article>`).join(''):'<div class="no-results">Nu am găsit locații pentru filtrul selectat.</div>';
 grid.querySelectorAll('[data-map-id]').forEach(b=>b.addEventListener('click',()=>focusLocationOnMap(b.dataset.mapId)));
 updateCount(false);
}
function updateCount(rerenderSelection=true){count.textContent=selected.size;localStorage.setItem('prismaSelected',JSON.stringify([...selected]));if(rerenderSelection)renderSelection()}
function toggleSelect(id){selected.has(id)?selected.delete(id):selected.add(id);renderCards();renderSelection();renderMapMarkers()}
function openDetails(id){
 const x=locations.find(l=>l.id===id); if(!x)return;
 const rows=[[x.meta1Label,x.meta1],[x.meta2Label,x.meta2],['Adresă / zonă',x.address],['Expunere',x.exposure],...(x.details||[])];
 document.getElementById('modalContent').innerHTML=`<div class="detail-grid"><img src="${x.image}" alt="${esc(x.name)}"><div class="detail-copy"><span class="eyebrow">${esc(x.area)}</span><h2>${esc(x.name)}</h2><div class="detail-price">${esc(x.priceLabel)}</div><div class="price-note detail-price-note">* Producția, decorarea/neutralizarea fac obiectul unei negocieri separate.</div><div class="detail-table">${rows.map(r=>`<div class="detail-row"><span>${esc(r[0])}</span><strong>${esc(r[1])}</strong></div>`).join('')}</div><p class="detail-note">Tarifele și disponibilitatea se confirmă la rezervare.</p><div class="detail-actions"><button class="ghost full" id="modalMapBtn">Vezi pe hartă</button><button class="primary full" onclick="toggleSelect('${x.id}');openDetails('${x.id}')">${selected.has(x.id)?'✓ Locație selectată':'Adaugă în selecție'}</button></div></div></div>`;
 const mb=document.getElementById('modalMapBtn'); if(mb) mb.onclick=()=>{closeModal();focusLocationOnMap(x.id)};
 modal.classList.add('open');modalBackdrop.classList.add('open');
}
function closeModal(){modal.classList.remove('open');modalBackdrop.classList.remove('open')}
function openDrawer(){drawer.classList.add('open');drawerBackdrop.classList.add('open');renderSelection()}
function closeDrawer(){drawer.classList.remove('open');drawerBackdrop.classList.remove('open')}
function renderSelection(){
 const items=locations.filter(x=>selected.has(x.id)); const box=document.getElementById('selectedList');
 box.innerHTML=items.length?items.map(x=>`<div class="sel-item"><img src="${x.image}" alt=""><div><strong>${esc(x.name)}</strong><span>${esc(x.priceLabel)}</span><small class="selection-price-note">* Producția, decorarea/neutralizarea fac obiectul unei negocieri separate.</small></div><button class="remove" onclick="toggleSelect('${x.id}')">×</button></div>`).join(''):'<div class="empty">Nu ai selectat încă nicio locație.</div>';
 const monthly=items.filter(x=>x.totalEligible!==false).reduce((s,x)=>s+(Number(x.price)||0),0);
 const excluded=items.filter(x=>x.totalEligible===false).length;
 document.getElementById('offerTotal').textContent=eur(monthly);
 document.getElementById('totalHint').textContent=excluded?`+ ${excluded} tarif(e) de catalog afișate separat`:'';
}
function buildRequestMessage(){
 const items=locations.filter(x=>selected.has(x.id));
 if(!items.length){alert('Selectează cel puțin o locație.');return null}
 const client=document.getElementById('clientName').value.trim();
 const campaign=document.getElementById('campaignName').value.trim();
 const contact=document.getElementById('clientContact').value.trim();
 const monthly=items.filter(x=>x.totalEligible!==false).reduce((s,x)=>s+(Number(x.price)||0),0);
 const lines=items.map((x,i)=>`${i+1}. ${x.name} | ${x.area} | ${x.priceLabel}`);
 return ['Bună ziua, doresc o ofertă pentru următoarele locații Prisma Advertising:','',...lines,'',`Subtotal orientativ tarife lunare: ${eur(monthly)}`,client?`Nume / companie: ${client}`:'',campaign?`Campanie / perioadă: ${campaign}`:'',contact?`Contact: ${contact}`:'','','Vă rog să îmi confirmați disponibilitatea și oferta comercială finală.'].filter(Boolean).join('\n');
}
function requestWhatsapp(){const message=buildRequestMessage();if(!message)return;window.open(`https://wa.me/40763504228?text=${encodeURIComponent(message)}`,'_blank','noopener')}
function requestEmail(){const message=buildRequestMessage();if(!message)return;const client=document.getElementById('clientName').value.trim();const subject=`Cerere ofertă OOH Prisma${client?' - '+client:''}`;window.location.href=`mailto:mihail.n.gabriel@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}

function pinIcon(q,selectedState=false){return L.divIcon({className:'',html:`<div class="prisma-pin ${q==='venue'?'venue':''}" style="width:${selectedState?20:16}px;height:${selectedState?20:16}px"></div>`,iconSize:[20,20],iconAnchor:[10,10]})}
function initMap(){
 if(map||!window.L)return;
 map=L.map('map',{zoomControl:true,scrollWheelZoom:true}).setView([45.72,25.1],6.4);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
 markerLayer=L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:38});
 map.addLayer(markerLayer);
 renderMapMarkers();
 setTimeout(()=>map.invalidateSize(),100);
}
function renderMapMarkers(){
 if(!map||!markerLayer)return;
 markerLayer.clearLayers(); markerIndex.clear();
 const items=filtered();
 items.forEach(x=>{
   const c=resolveCoords(x); if(!c)return;
   const marker=L.marker([c.lat,c.lng],{icon:pinIcon(c.q,selected.has(x.id))});
   marker.bindPopup(`<div class="map-popup"><img src="${x.image}" alt=""><strong>${esc(x.name)}</strong><span>${esc(x.area)}</span><span>${esc(x.address)}</span><span class="price">${esc(x.priceLabel)}</span><small class="popup-price-note">* Producția, decorarea/neutralizarea fac obiectul unei negocieri separate.</small><button type="button" data-popup-id="${x.id}">Vezi detalii</button></div>`);
   marker.on('popupopen',e=>{const el=e.popup.getElement();const btn=el&&el.querySelector('[data-popup-id]');if(btn)btn.onclick=()=>openDetails(x.id)});
   markerLayer.addLayer(marker); markerIndex.set(x.id,marker);
 });
 if(items.length && currentView==='map') fitVisibleMap();
}
function fitVisibleMap(){
 if(!map||!markerLayer)return;
 const bounds=markerLayer.getBounds(); if(bounds.isValid())map.fitBounds(bounds.pad(.12),{maxZoom:15});
}
function setViewMode(mode){
 currentView=mode;
 const mp=document.getElementById('mapPanel');
 const listBtn=document.getElementById('listViewBtn'), mapBtn=document.getElementById('mapViewBtn');
 if(mode==='map'){
   mp.hidden=false;grid.style.display='none';mapBtn.classList.add('active');listBtn.classList.remove('active');initMap();setTimeout(()=>{map.invalidateSize();fitVisibleMap()},100);
 }else{
   mp.hidden=true;grid.style.display='grid';listBtn.classList.add('active');mapBtn.classList.remove('active');
 }
}
function focusLocationOnMap(id){
 setViewMode('map');
 setTimeout(()=>{
  const x=locations.find(l=>l.id===id);const c=x&&resolveCoords(x);if(!x||!c||!map)return;
  map.setView([c.lat,c.lng],Math.max(map.getZoom(),16),{animate:true});
  const marker=markerIndex.get(id);if(marker){markerLayer.zoomToShowLayer(marker,()=>marker.openPopup())}
  document.getElementById('mapPanel').scrollIntoView({behavior:'smooth',block:'start'});
 },180);
}

document.getElementById('searchInput').addEventListener('input',e=>{query=e.target.value;renderCards();renderMapMarkers()});
document.querySelectorAll('[data-scroll]').forEach(b=>b.addEventListener('click',()=>document.querySelector(b.dataset.scroll).scrollIntoView({behavior:'smooth'})));
document.getElementById('selectionBtn').onclick=openDrawer;document.getElementById('closeDrawer').onclick=closeDrawer;drawerBackdrop.onclick=closeDrawer;document.getElementById('modalClose').onclick=closeModal;modalBackdrop.onclick=closeModal;document.getElementById('clearSelection').onclick=()=>{selected.clear();renderCards();renderSelection();renderMapMarkers()};document.getElementById('requestWhatsapp').onclick=requestWhatsapp;document.getElementById('requestEmail').onclick=requestEmail;
document.getElementById('listViewBtn').onclick=()=>setViewMode('list');document.getElementById('mapViewBtn').onclick=()=>setViewMode('map');document.getElementById('openMapHero').onclick=()=>{document.getElementById('locations').scrollIntoView({behavior:'smooth'});setTimeout(()=>setViewMode('map'),300)};document.getElementById('fitMapBtn').onclick=fitVisibleMap;
window.toggleSelect=toggleSelect;window.openDetails=openDetails;
document.getElementById('totalLocations').textContent=locations.length;
renderFilters();renderCards();renderSelection();

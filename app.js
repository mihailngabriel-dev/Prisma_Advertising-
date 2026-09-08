let currentFilter='all';
let query='';
let selected=new Set(JSON.parse(localStorage.getItem('prismaSelected')||'[]'));
let sortMode='default';
let favorites=new Set(JSON.parse(localStorage.getItem('prismaFavorites')||'[]'));
let favoritesOnly=false;
let visibleLimit=12;
let map=null, markerLayer=null;
const markerIndex=new Map();
const grid=document.getElementById('locationGrid');
const count=document.getElementById('selectionCount');
const drawer=document.getElementById('drawer'), drawerBackdrop=document.getElementById('drawerBackdrop');
const modal=document.getElementById('detailModal'), modalBackdrop=document.getElementById('modalBackdrop');
const eur=n=>new Intl.NumberFormat('ro-RO',{maximumFractionDigits:2}).format(n)+' EUR';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

const siteCoords={
  'bratianu':{lat:44.42668,lng:26.10493,q:'exact'},
  'buzesti':{lat:44.44791,lng:26.08220,q:'venue'},
  'dn1-stanga':{lat:44.5842223,lng:26.0704926,q:'exact'},
  'dn1-dreapta':{lat:44.5970857,lng:26.0712572,q:'exact'},
  'otopeni-unipol':{lat:44.5384039,lng:26.0683982,q:'exact'},
  'gara-constanta':{lat:44.16806,lng:28.63332,q:'exact'},
  'winmarkt-bistrita-1':{lat:47.13225,lng:24.48693,q:'exact'},'winmarkt-bistrita-2':{lat:47.13225,lng:24.48693,q:'exact'},
  'winmarkt-braila-1':{lat:45.2719014,lng:27.9671592,q:'exact'},'winmarkt-braila-2':{lat:45.2719014,lng:27.9671592,q:'exact'},
  'winmarkt-buzau-1':{lat:45.1531944,lng:26.8218956,q:'exact'},'winmarkt-buzau-2':{lat:45.1531944,lng:26.8218956,q:'exact'},
  'winmarkt-ploiesti-led':{lat:44.94115,lng:26.02090,q:'exact'},'winmarkt-ploiesti-parking':{lat:44.94115,lng:26.02090,q:'venue'},
  'winmarkt-ramnicu-1':{lat:45.10244,lng:24.36267,q:'exact'},'winmarkt-ramnicu-2':{lat:45.10244,lng:24.36267,q:'exact'},
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
function groupClass(g){return String(g||'').toLowerCase().replace(/[^a-z0-9]+/g,'-')}
function pickByGroup(group){return locations.find(x=>x.group===group)}
function categoryImage(group){return pickByGroup(group)?.image||'assets/bratianu.jpg'}
function renderCategories(){
 const target=document.getElementById('categoryTrack');
 const cats=[['București','București'],['DN1 / Otopeni','DN1 / Otopeni'],['Constanța','Constanța'],['Sinaia','Sinaia'],['Transalpina','Transalpina'],['Winmarkt','Winmarkt']];
 target.innerHTML=cats.map(([label,group])=>{const c=locations.filter(x=>x.group===group).length;return `<button class="category-card" data-category="${esc(group)}"><img src="${categoryImage(group)}" alt=""><span><strong>${esc(label)}</strong><small>${c} poziții</small></span></button>`}).join('')+`<button class="category-card all-card" data-category="all"><span class="all-icon">▦</span><span><strong>Toate locațiile</strong><small>Vezi inventarul</small></span></button>`;
 target.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{currentFilter=b.dataset.category;favoritesOnly=false;visibleLimit=12;renderFilters();renderCards();renderMapMarkers();document.getElementById('locations').scrollIntoView({behavior:'smooth'});}));
}
function renderFilters(){
 const box=document.getElementById('filters');
 box.innerHTML=[['all','Toate'],...groups().map(g=>[g,g])].map(([v,l])=>`<button class="filter ${currentFilter===v&&!favoritesOnly?'active':''}" data-filter="${esc(v)}">${esc(l)}</button>`).join('');
 box.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{currentFilter=b.dataset.filter;favoritesOnly=false;visibleLimit=12;renderFilters();renderCards();renderMapMarkers()}));
}
function filtered(){
 const q=query.toLowerCase().trim();
 const items=locations.filter(x=>(currentFilter==='all'||x.group===currentFilter)&&(!favoritesOnly||favorites.has(x.id))&&(!q||[x.name,x.area,x.address,x.meta1,x.meta2].join(' ').toLowerCase().includes(q)));
 if(sortMode==='name') items.sort((a,b)=>a.name.localeCompare(b.name,'ro'));
 if(sortMode==='priceAsc') items.sort((a,b)=>(Number(a.price)||0)-(Number(b.price)||0));
 if(sortMode==='priceDesc') items.sort((a,b)=>(Number(b.price)||0)-(Number(a.price)||0));
 if(sortMode==='favorites') items.sort((a,b)=>(favorites.has(b.id)?1:0)-(favorites.has(a.id)?1:0));
 return items;
}
function badgesFor(x){
 const out=[];
 if(x.group==='Sinaia'||x.group==='Transalpina') out.push(['Turistic','green']);
 else if(x.group==='Winmarkt') out.push(['Retail','purple']);
 else if(/DN1|Otopeni/i.test((x.area||'')+' '+(x.address||''))) out.push(['Trafic intens','orange']);
 else out.push(['Premium','orange']);
 const typ=String(x.meta1||'').trim(); if(typ&&typ.length<22)out.push([typ,'neutral']);
 return out.slice(0,2);
}
function cardHtml(x,featured=false){return `<article class="location-card group-${groupClass(x.group)} ${featured?'featured-card':''}">
 <div class="card-media"><img loading="lazy" src="${x.image}" alt="${esc(x.name)}"><div class="badge-overlay">${badgesFor(x).map(([b,c])=>`<span class="info-badge ${c}">${esc(b)}</span>`).join('')}</div><button class="favorite-btn ${favorites.has(x.id)?'active':''}" type="button" aria-label="Favorite" onclick="toggleFavorite('${x.id}')">${favorites.has(x.id)?'♥':'♡'}</button></div>
 <div class="card-body"><h3>${esc(x.name)}</h3><div class="card-sub">${esc(x.meta1||x.area)}</div><div class="card-meta-line"><span>⌖ ${esc(x.area)}</span><span>${esc(x.meta2||'')}</span></div><div class="price">${esc(x.priceLabel)}</div><div class="price-note">* Producția, decorarea/neutralizarea fac obiectul unei negocieri separate.</div><div class="card-actions"><button class="ghost" data-map-id="${x.id}">Pe hartă</button><button class="ghost" onclick="openDetails('${x.id}')">Detalii</button><button class="primary ${selected.has(x.id)?'selected':''}" onclick="toggleSelect('${x.id}')">${selected.has(x.id)?'✓ Selectat':'Selectează'}</button></div></div>
 </article>`}
function renderFeatured(){
 const ids=['bratianu','dn1-dreapta','gara-constanta'];
 const picks=ids.map(id=>locations.find(x=>x.id===id)).filter(Boolean);
 ['Sinaia','Transalpina','Winmarkt'].forEach(g=>{const x=locations.find(l=>l.group===g);if(x)picks.push(x)});
 const unique=[...new Map(picks.map(x=>[x.id,x])).values()].slice(0,6);
 document.getElementById('featuredGrid').innerHTML=unique.map(x=>cardHtml(x,true)).join('');
 document.querySelectorAll('#featuredGrid [data-map-id]').forEach(b=>b.addEventListener('click',()=>focusLocationOnMap(b.dataset.mapId)));
}
function renderCards(){
 const items=filtered(); const shown=items.slice(0,visibleLimit);
 document.getElementById('inventoryCount').textContent=favoritesOnly?`${items.length} favorite`:`${items.length} ${items.length===1?'locație':'locații'}`;
 grid.innerHTML=shown.length?shown.map(x=>cardHtml(x)).join(''):'<div class="no-results">Nu am găsit locații pentru filtrul selectat.</div>';
 grid.querySelectorAll('[data-map-id]').forEach(b=>b.addEventListener('click',()=>focusLocationOnMap(b.dataset.mapId)));
 const more=document.getElementById('loadMoreBtn');more.hidden=shown.length>=items.length;more.textContent=`Vezi mai multe locații (${items.length-shown.length})`;
 updateCount(false);updateFavoriteCount();
}
function updateFavoriteCount(){document.getElementById('favoriteCount').textContent=favorites.size}
function toggleFavorite(id){favorites.has(id)?favorites.delete(id):favorites.add(id);localStorage.setItem('prismaFavorites',JSON.stringify([...favorites]));renderCards();renderFeatured();}
function showFavorites(){favoritesOnly=!favoritesOnly;currentFilter='all';visibleLimit=12;renderFilters();renderCards();renderMapMarkers();document.getElementById('locations').scrollIntoView({behavior:'smooth'})}
function updateCount(rerenderSelection=true){const n=selected.size;count.textContent=n;document.getElementById('selectionFloatCount').textContent=n;document.getElementById('mobileSelectionCount').textContent=n;document.getElementById('selectionFloat').classList.toggle('show',n>0);localStorage.setItem('prismaSelected',JSON.stringify([...selected]));if(rerenderSelection)renderSelection()}
function toggleSelect(id){selected.has(id)?selected.delete(id):selected.add(id);renderCards();renderFeatured();renderSelection();renderMapMarkers()}
function openDetails(id){
 const x=locations.find(l=>l.id===id);if(!x)return;const rows=[[x.meta1Label,x.meta1],[x.meta2Label,x.meta2],['Adresă / zonă',x.address],['Expunere',x.exposure],...(x.details||[])];
 document.getElementById('modalContent').innerHTML=`<div class="detail-grid"><img src="${x.image}" alt="${esc(x.name)}"><div class="detail-copy"><div class="badge-row">${badgesFor(x).map(([b,c])=>`<span class="info-badge ${c}">${esc(b)}</span>`).join('')}</div><h2>${esc(x.name)}</h2><div class="detail-price">${esc(x.priceLabel)}</div><div class="price-note detail-price-note">* Producția, decorarea/neutralizarea fac obiectul unei negocieri separate.</div><div class="detail-table">${rows.map(r=>`<div class="detail-row"><span>${esc(r[0])}</span><strong>${esc(r[1])}</strong></div>`).join('')}</div><p class="detail-note">Tarifele și disponibilitatea se confirmă la rezervare.</p><div class="detail-actions"><button class="ghost full" id="modalMapBtn">Vezi pe hartă</button><button class="primary full" onclick="toggleSelect('${x.id}');openDetails('${x.id}')">${selected.has(x.id)?'✓ Locație selectată':'Adaugă în selecție'}</button></div></div></div>`;
 document.getElementById('modalMapBtn').onclick=()=>{closeModal();focusLocationOnMap(x.id)};modal.classList.add('open');modalBackdrop.classList.add('open');
}
function closeModal(){modal.classList.remove('open');modalBackdrop.classList.remove('open')}
function openDrawer(){drawer.classList.add('open');drawerBackdrop.classList.add('open');renderSelection()}
function closeDrawer(){drawer.classList.remove('open');drawerBackdrop.classList.remove('open')}
function renderSelection(){
 const items=locations.filter(x=>selected.has(x.id));const box=document.getElementById('selectedList');
 box.innerHTML=items.length?items.map(x=>`<div class="sel-item"><img src="${x.image}" alt=""><div><strong>${esc(x.name)}</strong><span>${esc(x.priceLabel)}</span><small>* Producția, decorarea/neutralizarea fac obiectul unei negocieri separate.</small></div><button class="remove" onclick="toggleSelect('${x.id}')">×</button></div>`).join(''):'<div class="empty">Nu ai selectat încă nicio locație.</div>';
 const monthly=items.filter(x=>x.totalEligible!==false).reduce((s,x)=>s+(Number(x.price)||0),0);const excluded=items.filter(x=>x.totalEligible===false).length;document.getElementById('offerTotal').textContent=eur(monthly);document.getElementById('totalHint').textContent=excluded?`+ ${excluded} tarif(e) afișate separat`:'';updateCount(false);
}
function buildRequestMessage(){
 const items=locations.filter(x=>selected.has(x.id));if(!items.length){alert('Selectează cel puțin o locație.');return null}const client=document.getElementById('clientName').value.trim(),campaign=document.getElementById('campaignName').value.trim(),contact=document.getElementById('clientContact').value.trim();const monthly=items.filter(x=>x.totalEligible!==false).reduce((s,x)=>s+(Number(x.price)||0),0);const lines=items.map((x,i)=>`${i+1}. ${x.name} | ${x.area} | ${x.priceLabel}`);return ['Bună ziua, doresc o ofertă pentru următoarele locații Prisma Advertising:','',...lines,'',`Subtotal orientativ tarife lunare: ${eur(monthly)}`,client?`Nume / companie: ${client}`:'',campaign?`Campanie / perioadă: ${campaign}`:'',contact?`Contact: ${contact}`:'','','Vă rog să îmi confirmați disponibilitatea și oferta comercială finală.'].filter(Boolean).join('\n');
}
function requestWhatsapp(){const message=buildRequestMessage();if(message)window.open(`https://wa.me/40763504228?text=${encodeURIComponent(message)}`,'_blank','noopener')}
function requestEmail(){const message=buildRequestMessage();if(!message)return;const client=document.getElementById('clientName').value.trim();window.location.href=`mailto:mihail.n.gabriel@gmail.com?subject=${encodeURIComponent('Cerere ofertă OOH Prisma'+(client?' - '+client:''))}&body=${encodeURIComponent(message)}`}
function pinIcon(q,selectedState=false){return L.divIcon({className:'',html:`<div class="prisma-pin ${q==='venue'?'venue':''} ${selectedState?'is-selected':''}"></div>`,iconSize:[22,22],iconAnchor:[11,11]})}
function initMap(){if(map||!window.L)return;map=L.map('map',{zoomControl:true,scrollWheelZoom:true}).setView([45.72,25.1],6.4);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);markerLayer=L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:38});map.addLayer(markerLayer);renderMapMarkers();setTimeout(()=>map.invalidateSize(),100)}
function renderMapMarkers(){if(!map||!markerLayer)return;markerLayer.clearLayers();markerIndex.clear();filtered().forEach(x=>{const c=resolveCoords(x);if(!c)return;const marker=L.marker([c.lat,c.lng],{icon:pinIcon(c.q,selected.has(x.id))});marker.bindPopup(`<div class="map-popup"><img src="${x.image}" alt=""><strong>${esc(x.name)}</strong><span>${esc(x.area)}</span><span class="price">${esc(x.priceLabel)}</span><small>* Producția, decorarea/neutralizarea fac obiectul unei negocieri separate.</small><button type="button" data-popup-id="${x.id}">Vezi detalii</button></div>`);marker.on('popupopen',e=>{const btn=e.popup.getElement()?.querySelector('[data-popup-id]');if(btn)btn.onclick=()=>openDetails(x.id)});markerLayer.addLayer(marker);markerIndex.set(x.id,marker)});}
function fitVisibleMap(){if(!map||!markerLayer)return;const bounds=markerLayer.getBounds();if(bounds.isValid())map.fitBounds(bounds.pad(.12),{maxZoom:15})}
function showMapFull(){initMap();document.getElementById('mapMiniPanel').classList.add('map-focus');document.getElementById('locations').scrollIntoView({behavior:'smooth'});setTimeout(()=>{map.invalidateSize();fitVisibleMap()},350)}
function focusLocationOnMap(id){showMapFull();setTimeout(()=>{const x=locations.find(l=>l.id===id),c=x&&resolveCoords(x);if(!x||!c||!map)return;map.setView([c.lat,c.lng],Math.max(map.getZoom(),16),{animate:true});const marker=markerIndex.get(id);if(marker)markerLayer.zoomToShowLayer(marker,()=>marker.openPopup())},400)}
function syncQuery(value){query=value;document.getElementById('searchInput').value=value;document.getElementById('headerSearch').value=value;visibleLimit=12;renderCards();renderMapMarkers()}

document.getElementById('searchInput').addEventListener('input',e=>syncQuery(e.target.value));document.getElementById('headerSearch').addEventListener('input',e=>syncQuery(e.target.value));
document.getElementById('sortSelect').addEventListener('change',e=>{sortMode=e.target.value;renderCards();renderMapMarkers()});
document.querySelectorAll('[data-scroll]').forEach(b=>b.addEventListener('click',()=>document.querySelector(b.dataset.scroll).scrollIntoView({behavior:'smooth'})));
document.getElementById('selectionBtn').onclick=openDrawer;document.getElementById('selectionFloatBtn').onclick=openDrawer;document.getElementById('mobileSelection').onclick=openDrawer;document.getElementById('ctaSelection').onclick=openDrawer;document.getElementById('closeDrawer').onclick=closeDrawer;drawerBackdrop.onclick=closeDrawer;document.getElementById('modalClose').onclick=closeModal;modalBackdrop.onclick=closeModal;
document.getElementById('clearSelection').onclick=()=>{selected.clear();renderCards();renderFeatured();renderSelection();renderMapMarkers()};document.getElementById('requestWhatsapp').onclick=requestWhatsapp;document.getElementById('requestEmail').onclick=requestEmail;
document.getElementById('openMapHero').onclick=showMapFull;document.getElementById('openMapHero2').onclick=showMapFull;document.getElementById('navMap').onclick=showMapFull;document.getElementById('mobileMap').onclick=showMapFull;document.getElementById('fitMapBtn').onclick=fitVisibleMap;document.getElementById('mapViewBtn').onclick=showMapFull;document.getElementById('listViewBtn').onclick=()=>document.getElementById('mapMiniPanel').classList.remove('map-focus');
document.getElementById('favoritesHeader').onclick=showFavorites;document.getElementById('mobileFav').onclick=showFavorites;document.getElementById('loadMoreBtn').onclick=()=>{visibleLimit+=12;renderCards()};
window.toggleSelect=toggleSelect;window.openDetails=openDetails;window.toggleFavorite=toggleFavorite;
document.getElementById('heroTotal').textContent=locations.length;document.getElementById('heroZones').textContent=groups().length;
initMap();renderCategories();renderFilters();renderFeatured();renderCards();renderSelection();updateFavoriteCount();

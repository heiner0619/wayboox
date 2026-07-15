// ===== STATE =====
let currentDayId = null;
let dayMaps = {};
let foodMap = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  renderOverview();
  renderTickets();
  renderFood();
  renderChecklist();
});

// ===== HERO：滚动到正文 =====
function scrollToMain() {
  const el = document.getElementById('mainPage');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== OVERVIEW =====
function renderOverview() {
  const c = document.getElementById('overviewTimeline');
  c.innerHTML = DAYS_DATA.map(d => `
    <div class="overview-day" onclick="openDay(${d.id})">
      <div class="overview-day-header">
        <span class="overview-day-label">${d.emoji} ${d.date} ${d.weekday}</span>
        <span class="overview-day-city">${d.cityTag}</span>
      </div>
      <div class="overview-day-title">${d.title}</div>
      <div class="overview-day-desc">${d.theme}</div>
      <span class="arrow">›</span>
    </div>
  `).join('');
}

// ===== DAY PAGE =====
function openDay(id) {
  currentDayId = id;
  const day = DAYS_DATA.find(d => d.id === id);
  document.getElementById('dayPageTitle').textContent = `${day.emoji} ${day.date} · ${day.title}`;
  document.getElementById('dayPageSub').textContent = day.theme;

  // Nav pills
  const nav = document.getElementById('dayNav');
  nav.innerHTML = DAYS_DATA.map(d => `
    <button class="day-nav-item ${d.id===id?'active':''}" onclick="switchDay(${d.id})">${d.emoji} Day${d.id}</button>
  `).join('');

  renderDayContent(day);

  document.getElementById('dayPage').classList.add('active');
  document.body.classList.add('page-open');
  document.getElementById('tabBar').style.display = 'none';
}

function switchDay(id) {
  if (dayMaps[currentDayId]) {
    dayMaps[currentDayId].remove();
    delete dayMaps[currentDayId];
  }
  openDay(id);
  document.getElementById('dayPage').scrollTop = 0;
}

function closeDayPage() {
  document.getElementById('dayPage').classList.remove('active');
  document.body.classList.remove('page-open');
  document.getElementById('tabBar').style.display = 'flex';
  if (dayMaps[currentDayId]) {
    dayMaps[currentDayId].remove();
    delete dayMaps[currentDayId];
  }
}

function renderDayContent(day) {
  const c = document.getElementById('dayPageContent');
  let html = '';

  // Banner（手绘卡片式，用 day.color 作为强调色）
  html += `<div class="day-banner" style="--day-accent:${day.color};">
    <div class="day-banner-inner">
      <div class="day-banner-emoji">${day.emoji}</div>
      <div class="day-banner-title">${day.title}</div>
      <div class="day-banner-sub">${day.date} ${day.weekday} · ${day.city}</div>
    </div>
  </div>`;

  // Tips — 前置于路线流程图，方便用户第一时间看到核心提示
  if (day.tips && day.tips.length) {
    html += `<div class="tips-box" style="margin:16px 16px 0;">
      <div class="tips-box-title">💡 今日 Tips</div>
      <ul>${day.tips.map(t => `<li>${t}</li>`).join('')}</ul>
    </div>`;
  }

  // Route summary
  html += `<div class="route-summary">
    <div class="route-summary-title">🗺️ 今日路线</div>
    <div class="route-flow">
      ${day.route.map((r,i) => `<span class="route-node">${r}</span>${i<day.route.length-1?'<span class="route-arrow">→</span>':''}`).join('')}
    </div>
  </div>`;

  // Map
  html += `<div class="map-container"><div id="dayMap${day.id}" style="height:100%;width:100%;"></div></div>`;

  // Timeline
  html += '<div class="timeline">';
  day.timeline.forEach((item, idx) => {
    const dotClass = item.type === 'food' ? 'food' : item.type === 'transport' ? 'transport' : item.type === 'shopping' ? 'shopping' : '';
    const cardClass = item.type === 'food' ? 'food-card' : item.type === 'transport' ? 'transport-card' : item.type === 'shopping' ? 'shopping-card' : '';
    const hasDetail = !!item.detail;
    const detailAttr = hasDetail ? `onclick="showSpotDetail(${day.id},${idx})"` : '';

    let badge = '';
    if (item.badge) badge = `<span class="ticket-badge">${item.badge}</span>`;
    else if (item.type === 'food') badge = '';

    html += `
      <div class="timeline-item">
        <div class="timeline-dot ${dotClass}"></div>
        <div class="timeline-time">${item.time}</div>
        <div class="timeline-card ${hasDetail?'has-detail':''} ${cardClass}" ${detailAttr}>
          <div class="timeline-card-header">
            <h4>${item.title}</h4>
            ${badge}
          </div>
          <div class="timeline-card-desc">${item.desc}</div>
          ${hasDetail ? '<div class="detail-hint">📖 点击查看详细攻略 →</div>' : ''}
        </div>
      </div>`;
  });
  html += '</div>';

  html += '<div style="height:40px;"></div>';
  c.innerHTML = html;

  // Init map after DOM
  setTimeout(() => initDayMap(day), 200);
}

// ===== MAP =====
function initDayMap(day) {
  const el = document.getElementById(`dayMap${day.id}`);
  if (!el) return;

  const map = L.map(el, { zoomControl: false, attributionControl: false }).setView(day.mapCenter, day.mapZoom);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
  }).addTo(map);

  // Add markers
  const markers = [];
  day.spots.forEach((s, i) => {
    const color = day.color;
    const icon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="marker-pin" style="background:${color};">${s.num || (i+1)}</div>`,
      iconSize: [28, 28], iconAnchor: [14, 14],
    });
    const marker = L.marker([s.lat, s.lng], { icon }).addTo(map);
    marker.bindPopup(`<b>${s.name}</b>`);
    markers.push(marker);
  });

  // Draw route line
  if (day.spots.length > 1) {
    const latlngs = day.spots.map(s => [s.lat, s.lng]);
    L.polyline(latlngs, {
      color: day.color, weight: 3, opacity: 0.7, dashArray: '8, 8',
    }).addTo(map);

    // Fit bounds
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.15));
  }

  dayMaps[day.id] = map;
}

// ===== SPOT DETAIL MODAL =====
function showSpotDetail(dayId, itemIdx) {
  const day = DAYS_DATA.find(d => d.id === dayId);
  const item = day.timeline[itemIdx];
  if (!item.detail) return;
  const d = item.detail;

  let html = `<div class="modal-emoji">${d.emoji}</div>`;
  html += `<div class="modal-title">${d.name}</div>`;
  html += `<div class="modal-subtitle">${d.subtitle}</div>`;

  // Info grid
  if (d.info && d.info.length) {
    html += '<div class="modal-info-grid">';
    d.info.forEach(i => {
      html += `<div class="modal-info-item"><div class="label">${i.label}</div><div class="value">${i.value}</div></div>`;
    });
    html += '</div>';
  }

  // History background
  if (d.history) {
    html += `<div class="modal-section history-section">
      <div class="modal-section-title">📜 历史背景</div>
      <div class="history-card">
        <div class="history-card-content">
          <p class="history-summary">${d.history.summary}</p>`;
    if (d.history.facts && d.history.facts.length) {
      html += '<div class="history-facts">';
      d.history.facts.forEach(f => {
        html += `<div class="history-fact-item"><span class="fact-label">${f.label}</span><span class="fact-value">${f.value}</span></div>`;
      });
      html += '</div>';
    }
    if (d.history.description) {
      html += `<p class="history-desc">${d.history.description}</p>`;
    }
    html += `</div></div></div>`;
  }

  // Highlights
  if (d.highlights && d.highlights.length) {
    html += `<div class="modal-section">
      <div class="modal-section-title">✨ 亮点与推荐</div>
      <ul>${d.highlights.map(h => `<li>${h}</li>`).join('')}</ul>
    </div>`;
  }

  // Warnings
  if (d.warnings && d.warnings.length) {
    html += `<div class="modal-section">
      <div class="modal-section-title">⚠️ 注意事项</div>
      ${d.warnings.map(w => `<div class="modal-warning">${w}</div>`).join('')}
    </div>`;
  }

  // Photos
  if (d.photos && d.photos.length) {
    html += `<div class="modal-section">
      <div class="modal-section-title">📸 拍照建议</div>
      <div class="modal-photo-tips">
        ${d.photos.map(p => `<p>${p}</p>`).join('')}
      </div>
    </div>`;
  }

  // Ticket
  if (d.ticketUrl) {
    html += `<div class="modal-section">
      <div class="modal-section-title">🎫 购票链接</div>
      <div class="modal-ticket-info">
        <p><a href="${d.ticketUrl}" target="_blank" rel="noopener">${d.ticketUrl}</a></p>
        <p style="margin-top:6px;">⚠️ 门票购买成功电子票会发邮箱，建议提前打印！</p>
      </div>
    </div>`;
  }

  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById('spotModal').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.getElementById('spotModal').classList.remove('active');
}

// ===== TICKET PAGE =====
function showTicketPage() {
  document.getElementById('ticketPage').classList.add('active');
  document.body.classList.add('page-open');
  document.getElementById('tabBar').style.display = 'none';
  setActiveTab(1);
}
function closeTicketPage() {
  document.getElementById('ticketPage').classList.remove('active');
  document.body.classList.remove('page-open');
  document.getElementById('tabBar').style.display = 'flex';
  setActiveTab(0);
}

function renderTickets() {
  const c = document.getElementById('ticketList');
  let html = '<div style="padding:0 0 8px;"><h3 style="font-size:16px;color:var(--red);margin-bottom:4px;">🔴 必须提前预约</h3><p style="font-size:12px;color:var(--text-light);">不预约可能进不去</p></div>';

  TICKETS_DATA.forEach(t => {
    const cls = t.optional ? 'ticket-item optional' : 'ticket-item';
    if (t.optional && !html.includes('建议提前购票')) {
      html += '<div style="padding:16px 0 8px;"><h3 style="font-size:16px;color:var(--gold);margin-bottom:4px;">🟡 建议提前购票</h3><p style="font-size:12px;color:var(--text-light);">可现场但建议提前</p></div>';
    }
    html += `<div class="${cls}">
      <h4>${t.name}</h4>
      <div class="ticket-meta">
        <span class="ticket-meta-tag price">${t.price}</span>
        <span class="ticket-meta-tag time">${t.advance}</span>
        ${!t.optional ? '<span class="ticket-meta-tag urgent">紧急！</span>' : ''}
      </div>
      ${t.url ? `<a class="ticket-url" href="${t.url}" target="_blank">${t.url}</a>` : ''}
      <div class="ticket-note">${t.note}</div>
    </div>`;
  });

  html += `<div style="margin-top:16px;padding:16px 18px;background:var(--yellow-soft);border-radius:18px 20px 16px 22px;border:2px solid var(--yellow);box-shadow:var(--shadow);">
    <div style="font-family:var(--font-serif);font-size:15px;font-weight:600;margin-bottom:8px;">📝 购票通用Tips</div>
    <ul style="list-style:none;font-size:12px;color:var(--text-light);line-height:1.8;">
      <li>1. 电子票都会发邮箱，建议提前打印‼️</li>
      <li>2. 提前官网查开放时间，节假日可能关闭‼️</li>
      <li>3. 不要迟到！迟到可能不让进‼️</li>
      <li>4. 支付需要 VISA/MASTER 卡，部分网站需翻墙‼️</li>
    </ul>
  </div>`;

  c.innerHTML = html;
}

// ===== FOOD PAGE =====
let foodMapCity = 'rome'; // current food map view: 'rome' or 'florence'
let foodMarkers = [];

function showFoodPage() {
  document.getElementById('foodPage').classList.add('active');
  document.body.classList.add('page-open');
  document.getElementById('tabBar').style.display = 'none';
  setActiveTab(2);

  setTimeout(() => initFoodMap(), 300);
}

function initFoodMap() {
  if (foodMap) { foodMap.remove(); foodMap = null; }
  foodMarkers = [];
  const el = document.getElementById('foodMapContainer');
  if (!el) return;
  el.innerHTML = '<div id="foodMapInner" style="height:100%;width:100%;"></div>';

  const center = foodMapCity === 'rome' ? [41.8970, 12.4780] : [43.7720, 11.2540];
  const zoom = 15;
  foodMap = L.map('foodMapInner', { zoomControl: false, attributionControl: false }).setView(center, zoom);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(foodMap);

  const foods = foodMapCity === 'rome' ? FOOD_DATA.rome : FOOD_DATA.florence;
  const markerGroup = [];
  foods.forEach((f, i) => {
    if (f.bad || !f.lat || !f.lng) return;
    const color = foodMapCity === 'rome' ? '#EE5A32' : '#78ABE0';
    const icon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="marker-pin" style="background:${color};font-size:12px;">${f.emoji}</div>`,
      iconSize: [28, 28], iconAnchor: [14, 14],
    });
    const marker = L.marker([f.lat, f.lng], { icon }).addTo(foodMap);
    const popupContent = `
      <div style="min-width:160px;">
        <b>${f.emoji} ${f.name}</b><br/>
        <span style="font-size:12px;color:#666;">${f.dish}</span><br/>
        ${f.price ? `<span style="font-size:11px;color:#4CAF50;font-weight:600;">${f.price}</span><br/>` : ''}
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
          ${f.googleMap ? `<a href="${f.googleMap}" target="_blank" rel="noopener" style="font-size:11px;background:#78ABE0;color:#fff;padding:3px 9px;border-radius:8px;text-decoration:none;display:inline-flex;align-items:center;gap:3px;border:1.5px solid #2C2620;">📍 导航</a>` : ''}
          ${f.reservation ? `<a href="${f.reservation}" target="_blank" rel="noopener" style="font-size:11px;background:#EE5A32;color:#fff;padding:3px 9px;border-radius:8px;text-decoration:none;display:inline-flex;align-items:center;gap:3px;border:1.5px solid #2C2620;">📞 预约</a>` : ''}
        </div>
      </div>`;
    marker.bindPopup(popupContent);
    markerGroup.push(marker);
    foodMarkers.push(marker);
  });

  if (markerGroup.length > 1) {
    const group = L.featureGroup(markerGroup);
    foodMap.fitBounds(group.getBounds().pad(0.15));
  }
}

function switchFoodCity(city) {
  if (city === foodMapCity) return;
  foodMapCity = city;
  // Update toggle buttons
  document.querySelectorAll('.food-city-toggle').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.city === city);
  });
  // Scroll to the corresponding section
  const sectionEl = document.getElementById(`food-section-${city}`);
  if (sectionEl) {
    sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  initFoodMap();
}

function focusFoodOnMap(lat, lng, name) {
  if (!foodMap || !lat || !lng) return;
  foodMap.flyTo([lat, lng], 17, { duration: 0.6 });
  // Open the matching marker popup
  foodMarkers.forEach(m => {
    const ll = m.getLatLng();
    if (Math.abs(ll.lat - lat) < 0.0001 && Math.abs(ll.lng - lng) < 0.0001) {
      m.openPopup();
    }
  });
  // Scroll map into view
  document.getElementById('foodMapContainer').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeFoodPage() {
  document.getElementById('foodPage').classList.remove('active');
  document.body.classList.remove('page-open');
  document.getElementById('tabBar').style.display = 'flex';
  setActiveTab(0);
  if (foodMap) { foodMap.remove(); foodMap = null; }
  foodMarkers = [];
}

function renderFood() {
  const c = document.getElementById('foodContent');
  let html = '';

  // City toggle buttons
  html += `<div style="display:flex;gap:8px;padding:12px 16px 4px;position:sticky;top:56px;z-index:5;background:var(--bg);">
    <button class="food-city-toggle active" data-city="rome" onclick="switchFoodCity('rome')">🏛️ 罗马 (${FOOD_DATA.rome.filter(f=>!f.bad).length}家)</button>
    <button class="food-city-toggle" data-city="florence" onclick="switchFoodCity('florence')">🎨 佛罗伦萨 (${FOOD_DATA.florence.filter(f=>!f.bad).length}家)</button>
  </div>`;

  // Rome section
  html += `<div id="food-section-rome"><div class="food-section-title">🏛️ 罗马美食</div>`;
  FOOD_DATA.rome.forEach(f => {
    html += buildFoodCard(f, 'rome');
  });
  html += '</div>';

  // Florence section
  html += `<div id="food-section-florence" style="margin-top:8px;"><div class="food-section-title">🎨 佛罗伦萨美食</div>`;
  FOOD_DATA.florence.forEach(f => {
    html += buildFoodCard(f, 'florence');
  });
  html += '</div>';

  c.innerHTML = html;
}

function buildFoodCard(f, city) {
  if (f.bad) {
    return `<div class="food-card-item food-bad">
      <div class="food-emoji">${f.emoji}</div>
      <div class="food-info">
        <h4>${f.name}</h4>
        <p>${f.dish}</p>
        <p style="font-size:11px;color:var(--text-lighter);">${f.loc} · ${f.rating}</p>
        <span class="food-day">${f.day}</span>
      </div>
    </div>`;
  }

  const hasLocation = f.lat && f.lng;
  const mapClick = hasLocation ? `onclick="switchFoodCity('${city}');setTimeout(()=>focusFoodOnMap(${f.lat},${f.lng},'${f.name.replace(/'/g,"\\'")}'),400);"` : '';

  let actionBtns = '<div class="food-action-btns">';
  if (f.googleMap) {
    actionBtns += `<a href="${f.googleMap}" target="_blank" rel="noopener" class="food-btn food-btn-nav" onclick="event.stopPropagation();">📍 Google导航</a>`;
  }
  if (f.reservation) {
    actionBtns += `<a href="${f.reservation}" target="_blank" rel="noopener" class="food-btn food-btn-book" onclick="event.stopPropagation();">📞 在线预约</a>`;
  }
  if (!f.reservation && f.reservationNote) {
    actionBtns += `<span class="food-btn food-btn-info">${f.reservationNote}</span>`;
  }
  actionBtns += '</div>';

  return `<div class="food-card-item" ${mapClick} style="${hasLocation ? 'cursor:pointer;' : ''}">
    <div class="food-emoji">${f.emoji}</div>
    <div class="food-info">
      <h4>${f.name} ${hasLocation ? '<span style="font-size:11px;color:var(--accent);font-weight:400;">📍</span>' : ''}</h4>
      <p>${f.dish}</p>
      <p style="font-size:11px;color:var(--text-lighter);">${f.loc} · ${f.rating}</p>
      ${f.address ? `<p style="font-size:10px;color:var(--text-lighter);margin-top:2px;">📍 ${f.address}</p>` : ''}
      <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">
        ${f.price ? `<span class="food-price">${f.price}</span>` : ''}
        <span class="food-day">${f.day}</span>
      </div>
      ${actionBtns}
    </div>
  </div>`;
}

// ===== CHECKLIST PAGE =====
function showChecklistPage() {
  document.getElementById('checklistPage').classList.add('active');
  document.body.classList.add('page-open');
  document.getElementById('tabBar').style.display = 'none';
  setActiveTab(3);
}
function closeChecklistPage() {
  document.getElementById('checklistPage').classList.remove('active');
  document.body.classList.remove('page-open');
  document.getElementById('tabBar').style.display = 'flex';
  setActiveTab(0);
}

function renderChecklist() {
  const saved = JSON.parse(localStorage.getItem('italy_checklist') || '{}');
  const c = document.getElementById('checklistContent');
  c.innerHTML = CHECKLIST_DATA.map((item, i) => {
    const checked = saved[i] ? 'checked' : '';
    return `<div class="checklist-item ${checked}" onclick="toggleCheck(${i}, this)">
      <div class="check-box">${saved[i] ? '✓' : ''}</div>
      <span class="check-text">${item}</span>
    </div>`;
  }).join('');
}

function toggleCheck(idx, el) {
  const saved = JSON.parse(localStorage.getItem('italy_checklist') || '{}');
  saved[idx] = !saved[idx];
  localStorage.setItem('italy_checklist', JSON.stringify(saved));
  el.classList.toggle('checked');
  el.querySelector('.check-box').textContent = saved[idx] ? '✓' : '';
}

// ===== TAB MANAGEMENT =====
function setActiveTab(idx) {
  document.querySelectorAll('.tab-item').forEach((t, i) => {
    t.classList.toggle('active', i === idx);
  });
}

function showMain() {
  // Close all sub-pages without re-setting tab
  ['ticketPage','foodPage','checklistPage','dayPage'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });
  document.body.classList.remove('page-open');
  document.getElementById('tabBar').style.display = 'flex';
  if (dayMaps[currentDayId]) {
    dayMaps[currentDayId].remove();
    delete dayMaps[currentDayId];
  }
  if (foodMap) { foodMap.remove(); foodMap = null; }
  setActiveTab(0);
}

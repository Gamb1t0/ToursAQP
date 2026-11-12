const AREQUIPA_CENTER = [-16.3988, -71.5369];
const MAX_STOPS = 25;
const MAX_KM_A_PIE = 15;
const ROUTE_DEBOUNCE_MS = 300;
const TOAST_MS = 3500;

// Los colores viven en style.css (--cat-*): aqui solo se elige la variable.
const CATEGORY_TOKENS = {
  'Histórico': '--cat-historico',
  'Cultural': '--cat-cultural',
  'Natural': '--cat-natural',
  'Comercial': '--cat-comercial',
  'Educativo': '--cat-educativo',
  'Restaurantes': '--cat-restaurantes',
  'Entretenimiento': '--cat-entretenimiento',
};

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Iconos dibujados en un mismo trazo, en lugar de caracteres de texto.
const ICON_PATHS = {
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[name]}"/></svg>`;
}

const state = {
  places: [],
  types: [],
  placesById: new Map(),
  search: '',
  category: null,
  stops: [],              // ids en orden de visita
  profile: 'foot',        // 'foot' | 'car'
  route: null,            // respuesta del servidor para las paradas actuales
  loadingRoute: false,
  user: null,
  savedRoutes: [],
  tab: 'explorar',
};

let map;
let markersLayer;
let routeLayer;
const markersById = new Map();
let routeRequestId = 0;
let routeTimer = null;
let toastTimer = null;

const el = (id) => document.getElementById(id);

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

function normalizeText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function categoryColor(category) {
  return `var(${CATEGORY_TOKENS[category] || '--cat-otro'})`;
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function isSameOrder(a, b) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

async function api(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

// Se usa popover para que el aviso quede tambien encima de los dialogos abiertos.
function toast(message, { error = false } = {}) {
  const box = el('toast');
  box.textContent = message;
  box.classList.toggle('is-error', error);
  if (box.matches(':popover-open')) box.hidePopover();
  box.showPopover();

  // Se vacia y se vuelve a escribir para que se anuncie aunque el texto se repita.
  const live = el('anuncio');
  live.textContent = '';
  setTimeout(() => { live.textContent = message; }, 50);

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.hidePopover(), TOAST_MS);
}

function confirmDialog(title, text) {
  const dialog = el('dlgConfirmar');
  el('confirmarTitulo').textContent = title;
  el('confirmarTexto').textContent = text;
  dialog.returnValue = 'cancel';
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
  });
}

// ===== Pestanas =====

function setTab(tab) {
  state.tab = tab;
  const panels = { explorar: 'panelExplorar', ruta: 'panelRuta', guardadas: 'panelGuardadas' };
  for (const [name, panelId] of Object.entries(panels)) {
    el(panelId).classList.toggle('hidden', name !== tab);
  }
  document.querySelectorAll('.tab').forEach((button) => {
    const selected = button.dataset.tab === tab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
}

// Patron ARIA de pestanas: flechas, Inicio y Fin mueven el foco y activan la pestana.
function onTabKeydown(e) {
  const tabs = [...document.querySelectorAll('.tab')];
  const index = tabs.indexOf(e.currentTarget);
  const targets = {
    ArrowRight: (index + 1) % tabs.length,
    ArrowLeft: (index - 1 + tabs.length) % tabs.length,
    Home: 0,
    End: tabs.length - 1,
  };
  if (!(e.key in targets)) return;
  e.preventDefault();
  const next = tabs[targets[e.key]];
  setTab(next.dataset.tab);
  next.focus();
}

// ===== Mapa =====

function initMap() {
  map = L.map('mapa', {
    zoomAnimation: !REDUCED_MOTION,
    fadeAnimation: !REDUCED_MOTION,
    markerZoomAnimation: !REDUCED_MOTION,
  }).setView(AREQUIPA_CENTER, 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Rutas: <a href="https://routing.openstreetmap.de/about.html">FOSSGIS</a>',
    maxZoom: 19,
  }).addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

function popupContent(place) {
  const added = state.stops.includes(place.id);
  const container = document.createElement('div');
  container.innerHTML =
    `<strong class="popup-title">${escapeHtml(place.label)}</strong>` +
    `<span class="popup-cat"><span class="dot" style="--cat:${categoryColor(place.category)}"></span>${escapeHtml(place.category || 'Sin categoría')}</span>` +
    (place.desc ? `<p class="popup-desc">${escapeHtml(place.desc)}</p>` : '');

  const button = document.createElement('button');
  button.className = `btn btn-sm popup-action ${added ? 'btn-ghost' : 'btn-primary'}`;
  button.textContent = added ? 'Quitar de mi ruta' : 'Agregar a mi ruta';
  button.onclick = () => {
    map.closePopup();
    toggleStop(place.id);
  };
  container.appendChild(button);
  return container;
}

function placeIcon(place) {
  const stopIndex = state.stops.indexOf(place.id);
  if (stopIndex >= 0) {
    return L.divIcon({
      className: '',
      html: `<div class="pin pin-stop">${stopIndex + 1}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -14],
    });
  }
  return L.divIcon({
    className: '',
    // Punto visible de 16px dentro de un area tactil de 24px (WCAG 2.5.8).
    className: "pin-hit",
    html: `<div class="pin pin-place" style="--cat:${categoryColor(place.category)}"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -10],
  });
}

function matchesFilters(place) {
  const matchesCategory = !state.category || place.category === state.category;
  const matchesSearch = normalizeText(place.label).includes(normalizeText(state.search).trim());
  return matchesCategory && matchesSearch;
}

function renderMarkers() {
  markersLayer.clearLayers();
  markersById.clear();

  for (const place of state.places) {
    const stopIndex = state.stops.indexOf(place.id);
    // Las paradas siguen visibles aunque el filtro las oculte de la lista.
    if (stopIndex < 0 && !matchesFilters(place)) continue;

    const marker = L.marker([place.lat, place.lon], {
      icon: placeIcon(place),
      title: place.label,
      alt: place.label,
      zIndexOffset: stopIndex >= 0 ? 1000 : 0,
    })
      .bindPopup(() => popupContent(place))
      .addTo(markersLayer);
    markersById.set(place.id, marker);
  }
}

function focusPlace(id) {
  const place = state.placesById.get(id);
  map.setView([place.lat, place.lon], Math.max(map.getZoom(), 16), { animate: !REDUCED_MOTION });
  markersById.get(id)?.openPopup();
}

function renderRouteLine() {
  routeLayer.clearLayers();
  if (!state.route) return;

  const { geometry, routed } = state.route;
  L.polyline(geometry, { className: 'route-casing', weight: 8, opacity: 0.9 }).addTo(routeLayer);
  L.polyline(geometry, {
    className: 'route-line',
    weight: 5,
    dashArray: routed ? null : '4 10',
  }).addTo(routeLayer);
}

function fitToStops() {
  const points = state.route
    ? state.route.geometry
    : state.stops.map((id) => {
        const place = state.placesById.get(id);
        return [place.lat, place.lon];
      });
  if (points.length === 0) return;
  map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 16, animate: !REDUCED_MOTION });
}

// ===== Explorar =====

function renderChips() {
  const container = el('chipsCategoria');
  container.innerHTML = '';

  const addChip = (label, value) => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.setAttribute('aria-pressed', String(state.category === value));
    if (value) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.setProperty('--cat', categoryColor(value));
      chip.appendChild(dot);
    }
    chip.append(label);
    chip.onclick = () => {
      state.category = value;
      renderChips();
      renderPlaces();
      renderMarkers();
    };
    container.appendChild(chip);
  };

  addChip('Todos', null);
  for (const type of state.types) addChip(type.name, type.name);
}

function renderPlaces() {
  const visible = state.places.filter(matchesFilters);
  el('lblResultados').textContent =
    visible.length === 0
      ? 'Ningún lugar coincide con tu búsqueda.'
      : `${visible.length} ${visible.length === 1 ? 'lugar' : 'lugares'}`;

  const list = el('listaLugares');
  list.innerHTML = '';

  for (const place of visible) {
    const added = state.stops.includes(place.id);
    const item = document.createElement('li');
    item.className = 'place-item';

    const main = document.createElement('button');
    main.className = 'place-main';
    main.innerHTML =
      `<span class="place-name">${escapeHtml(place.label)}</span>` +
      `<span class="place-cat"><span class="dot" style="--cat:${categoryColor(place.category)}"></span>${escapeHtml(place.category || 'Sin categoría')}</span>` +
      (place.desc ? `<span class="place-desc">${escapeHtml(place.desc)}</span>` : '');
    main.onclick = () => focusPlace(place.id);

    const add = document.createElement('button');
    add.className = `add-btn${added ? ' is-added' : ''}`;
    add.innerHTML = icon(added ? 'check' : 'plus');
    add.setAttribute('aria-label', `${added ? 'Quitar de' : 'Agregar a'} mi ruta: ${place.label}`);
    add.title = added ? 'Quitar de mi ruta' : 'Agregar a mi ruta';
    add.onclick = () => toggleStop(place.id);

    item.append(main, add);
    list.appendChild(item);
  }
}

// ===== Mi ruta =====

function toggleStop(id) {
  if (state.stops.includes(id)) {
    setStops(state.stops.filter((stopId) => stopId !== id));
    return;
  }
  if (state.stops.length >= MAX_STOPS) {
    toast(`Una ruta puede tener hasta ${MAX_STOPS} paradas.`, { error: true });
    return;
  }
  setStops([...state.stops, id]);
}

function moveStop(index, delta) {
  const stops = [...state.stops];
  const [id] = stops.splice(index, 1);
  stops.splice(index + delta, 0, id);
  setStops(stops);
}

// Unico punto de cambio de las paradas: mantiene sincronizados lista, mapa y trazado.
function setStops(stops, { fit = false } = {}) {
  state.stops = stops;
  state.route = null;
  renderPlaces();
  renderMarkers();
  renderRouteLine();
  renderStops();
  scheduleRouteUpdate({ fit });
}

function scheduleRouteUpdate({ fit = false } = {}) {
  clearTimeout(routeTimer);
  routeRequestId++;

  if (state.stops.length < 2) {
    state.loadingRoute = false;
    renderStops();
    if (fit) fitToStops();
    return;
  }

  state.loadingRoute = true;
  renderStops();
  routeTimer = setTimeout(() => updateRoute({ fit }), ROUTE_DEBOUNCE_MS);
}

function applyRoute(route) {
  state.route = route;
  state.stops = route.order;
  state.loadingRoute = false;
  renderMarkers();
  renderRouteLine();
  renderStops();
}

async function updateRoute({ fit }) {
  const requestId = ++routeRequestId;
  try {
    const route = await api('/route/directions', {
      method: 'POST',
      body: JSON.stringify({ nodeIds: state.stops, profile: state.profile }),
    });
    // Si el usuario cambio algo mientras tanto, esta respuesta ya no vale.
    if (requestId !== routeRequestId) return;
    applyRoute(route);
    // Sin encuadrar de mas: el mapa solo se mueve si la ruta se sale de la vista.
    if (fit || !map.getBounds().contains(L.latLngBounds(route.geometry))) fitToStops();
  } catch (err) {
    if (requestId !== routeRequestId) return;
    state.loadingRoute = false;
    renderStops();
    toast(err.message, { error: true });
  }
}

async function onOptimizar() {
  clearTimeout(routeTimer);
  const requestId = ++routeRequestId;
  const previousDuration = state.route?.duration ?? null;
  const previousOrder = state.stops;

  state.loadingRoute = true;
  renderStops();

  try {
    const route = await api('/route/compute', {
      method: 'POST',
      body: JSON.stringify({ nodeIds: state.stops, profile: state.profile }),
    });
    if (requestId !== routeRequestId) return;

    applyRoute(route);
    renderPlaces();
    fitToStops();

    const saved = previousDuration !== null && route.duration !== null ? previousDuration - route.duration : 0;
    if (isSameOrder(previousOrder, route.order) || saved < 30) {
      toast('Tus paradas ya estaban en un buen orden.');
    } else {
      toast(`Listo: te ahorras ${formatDuration(saved)}.`);
    }
  } catch (err) {
    if (requestId !== routeRequestId) return;
    state.loadingRoute = false;
    renderStops();
    toast(err.message, { error: true });
  }
}

function renderNotice() {
  const notice = el('avisoRuta');
  notice.innerHTML = '';
  const { route, profile } = state;

  if (!route) {
    notice.classList.add('hidden');
    return;
  }

  if (!route.routed) {
    notice.textContent =
      'No pudimos consultar las calles en este momento. Esto es una estimación en línea recta: la distancia real será mayor.';
  } else if (profile === 'foot' && route.distance / 1000 > MAX_KM_A_PIE) {
    notice.append('Es mucho para caminar. ');
    const change = document.createElement('button');
    change.textContent = 'Ver en auto';
    change.onclick = () => setProfile('car');
    notice.appendChild(change);
  } else {
    notice.classList.add('hidden');
    return;
  }
  notice.classList.remove('hidden');
}

function renderStats() {
  const { route, stops, loadingRoute } = state;
  el('statDistancia').textContent = route ? formatDistance(route.distance) : '–';
  el('statTiempo').textContent = route && route.duration !== null ? formatDuration(route.duration) : '–';
  document.querySelector('.stats').classList.toggle('is-loading', loadingRoute);
  document.querySelector('.stats').classList.toggle('hidden', stops.length < 2);
}

function renderStops() {
  const { stops, route } = state;
  const count = stops.length;

  const counter = el('contadorParadas');
  counter.textContent = count;
  counter.classList.toggle('hidden', count === 0);

  el('rutaVacia').classList.toggle('hidden', count > 0);
  el('rutaContenido').classList.toggle('hidden', count === 0);

  document.querySelectorAll('.segment').forEach((button) => {
    button.setAttribute('aria-checked', String(button.dataset.profile === state.profile));
  });

  renderStats();
  renderNotice();

  el('btnOptimizar').disabled = count < 3 || state.loadingRoute;
  el('optimizarAyuda').classList.toggle('hidden', count >= 3);
  el('btnGuardar').disabled = count < 2;

  const legs = route && isSameOrder(route.order, stops) ? route.legs : null;
  const list = el('listaParadas');
  list.innerHTML = '';

  stops.forEach((id, index) => {
    const place = state.placesById.get(id);
    const item = document.createElement('li');
    item.className = 'stop';

    if (legs && index > 0) {
      const leg = legs[index - 1];
      const legInfo = document.createElement('div');
      legInfo.className = 'stop-leg';
      legInfo.textContent = leg.duration !== null
        ? `${formatDistance(leg.distance)} · ${formatDuration(leg.duration)}`
        : formatDistance(leg.distance);
      item.appendChild(legInfo);
    }

    const row = document.createElement('div');
    row.className = 'stop-row';

    const number = document.createElement('span');
    number.className = 'stop-number';
    number.textContent = index + 1;

    const name = document.createElement('button');
    name.className = 'stop-name';
    name.textContent = place.label;
    name.onclick = () => focusPlace(id);

    const controls = document.createElement('div');
    controls.className = 'stop-controls';
    const iconButton = (iconName, label, onClick, disabled = false, extraClass = '') => {
      const button = document.createElement('button');
      button.className = `icon-btn ${extraClass}`;
      button.innerHTML = icon(iconName);
      button.title = label;
      button.setAttribute('aria-label', `${label}: ${place.label}`);
      button.disabled = disabled;
      button.onclick = onClick;
      return button;
    };
    controls.append(
      iconButton('up', 'Subir', () => moveStop(index, -1), index === 0),
      iconButton('down', 'Bajar', () => moveStop(index, 1), index === count - 1),
      iconButton('close', 'Quitar', () => toggleStop(id), false, 'danger')
    );

    row.append(number, name, controls);
    item.appendChild(row);
    list.appendChild(item);
  });
}

function setProfile(profile) {
  if (state.profile === profile) return;
  state.profile = profile;
  state.route = null;
  renderRouteLine();
  scheduleRouteUpdate({ fit: true });
}

async function onVaciar() {
  setStops([]);
  toast('Ruta vaciada.');
}

// ===== Rutas guardadas =====

async function cargarRutasGuardadas() {
  state.savedRoutes = state.user ? await api('/routes') : [];
  renderSavedRoutes();
}

function renderSavedRoutes() {
  const list = el('listaRutas');
  list.innerHTML = '';

  const isEmpty = state.savedRoutes.length === 0;
  el('guardadasVacia').classList.toggle('hidden', !isEmpty);
  el('btnGuardadasLogin').classList.toggle('hidden', Boolean(state.user));
  el('guardadasTitulo').textContent = state.user ? 'Aún no tienes rutas guardadas' : 'Tus rutas, siempre a mano';
  el('guardadasTexto').textContent = state.user
    ? 'Arma una ruta en “Mi ruta” y guárdala para volver a ella cuando quieras.'
    : 'Inicia sesión para ver tus rutas guardadas.';

  for (const route of state.savedRoutes) {
    const item = document.createElement('li');
    item.className = 'saved-item';

    const main = document.createElement('button');
    main.className = 'saved-main';
    const date = new Date(`${route.created_at.replace(' ', 'T')}Z`).toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    main.innerHTML =
      `<span class="saved-name">${escapeHtml(route.name)}</span>` +
      `<span class="saved-date">${escapeHtml(date)}</span>`;
    main.onclick = () => abrirRutaGuardada(route.id);

    const remove = document.createElement('button');
    remove.className = 'icon-btn danger';
    remove.innerHTML = icon('close');
    remove.title = 'Eliminar';
    remove.setAttribute('aria-label', `Eliminar ruta: ${route.name}`);
    remove.onclick = () => eliminarRutaGuardada(route);

    item.append(main, remove);
    list.appendChild(item);
  }
}

async function abrirRutaGuardada(id) {
  const { order } = await api(`/routes/${id}`);
  const stops = order.filter((stopId) => state.placesById.has(stopId));
  setTab('ruta');
  setStops(stops, { fit: true });
}

async function eliminarRutaGuardada(route) {
  const confirmed = await confirmDialog('¿Eliminar esta ruta?', `“${route.name}” se eliminará para siempre.`);
  if (!confirmed) return;
  await api(`/routes/${route.id}`, { method: 'DELETE' });
  await cargarRutasGuardadas();
  toast('Ruta eliminada.');
}

function onGuardar() {
  if (!state.user) {
    openLogin('Inicia sesión para guardar tus rutas.');
    return;
  }
  if (state.user.role !== 'admin') {
    toast('Por ahora, solo los administradores pueden guardar rutas.', { error: true });
    return;
  }
  el('guardarNombre').value = '';
  el('dlgGuardar').showModal();
}

async function onSubmitGuardar(e) {
  e.preventDefault();
  const name = el('guardarNombre').value.trim();
  if (!name) return;
  await api('/routes', { method: 'POST', body: JSON.stringify({ name, nodeIds: state.stops }) });
  el('dlgGuardar').close();
  await cargarRutasGuardadas();
  toast('Ruta guardada.');
}

// ===== Cuenta =====

function renderAccount() {
  const { user } = state;
  el('btnCuenta').textContent = user ? 'Salir' : 'Iniciar sesión';
  el('lblUsuario').textContent = user ? `Hola, ${user.nombreCompleto}` : '';
  el('lblUsuario').classList.toggle('hidden', !user);
  el('btnAdmin').classList.toggle('hidden', user?.role !== 'admin');
}

function openLogin(reason = '') {
  el('loginError').classList.add('hidden');
  el('loginUser').value = '';
  el('loginPass').value = '';
  el('loginMotivo').textContent = reason;
  el('loginMotivo').classList.toggle('hidden', !reason);
  el('dlgLogin').showModal();
}

async function onCuenta() {
  if (!state.user) {
    openLogin();
    return;
  }
  await api('/logout', { method: 'POST' });
  state.user = null;
  renderAccount();
  await cargarRutasGuardadas();
  toast('Sesión cerrada.');
}

async function onSubmitLogin(e) {
  e.preventDefault();
  try {
    const { user } = await api('/login', {
      method: 'POST',
      body: JSON.stringify({ username: el('loginUser').value, password: el('loginPass').value }),
    });
    state.user = user;
    renderAccount();
    el('dlgLogin').close();
    await cargarRutasGuardadas();
  } catch (err) {
    el('loginError').textContent = err.message;
    el('loginError').classList.remove('hidden');
  }
}

// ===== Editar lugares (administrador) =====

async function recargarLugares() {
  state.places = await api('/nodes/all');
  state.placesById = new Map(state.places.map((place) => [place.id, place]));
  state.stops = state.stops.filter((id) => state.placesById.has(id));
  renderPlaces();
  renderMarkers();
  renderStops();
}

async function onAdmin() {
  const [nodes, types] = await Promise.all([api('/admin/nodes'), api('/types')]);
  const tbody = document.querySelector('#tablaLugares tbody');
  tbody.innerHTML = '';

  for (const node of nodes) {
    const row = document.createElement('tr');

    const inputs = {};
    for (const [field, label] of [['code', 'Código'], ['label', 'Nombre'], ['desc', 'Descripción'], ['ubication', 'Ubicación']]) {
      const cell = document.createElement('td');
      const input = document.createElement('input');
      input.className = 'input';
      input.value = node[field] ?? '';
      input.setAttribute('aria-label', `${label} de ${node.label}`);
      inputs[field] = input;
      cell.appendChild(input);
      row.appendChild(cell);
    }

    const typeCell = document.createElement('td');
    const select = document.createElement('select');
    select.className = 'input';
    select.setAttribute('aria-label', `Categoría de ${node.label}`);
    for (const type of types) {
      const option = document.createElement('option');
      option.value = type.id;
      option.textContent = type.name;
      option.selected = type.id === node.type_id;
      select.appendChild(option);
    }
    typeCell.appendChild(select);
    row.appendChild(typeCell);

    const actionCell = document.createElement('td');
    const save = document.createElement('button');
    save.className = 'btn btn-secondary btn-sm';
    save.textContent = 'Guardar';
    save.onclick = async () => {
      await api(`/admin/nodes/${node.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          code: inputs.code.value,
          label: inputs.label.value,
          desc: inputs.desc.value,
          ubication: inputs.ubication.value,
          type_id: Number(select.value),
        }),
      });
      await recargarLugares();
      toast('Lugar actualizado.');
    };
    actionCell.appendChild(save);
    row.appendChild(actionCell);

    tbody.appendChild(row);
  }

  el('dlgAdmin').showModal();
}

// ===== Inicializacion =====

function bindEvents() {
  document.querySelectorAll('.tab').forEach((button) => {
    button.addEventListener('click', () => setTab(button.dataset.tab));
    button.addEventListener('keydown', onTabKeydown);
  });
  document.querySelectorAll('.segment').forEach((button) => {
    button.addEventListener('click', () => setProfile(button.dataset.profile));
  });

  el('txtBuscar').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderPlaces();
    renderMarkers();
  });

  el('btnIrExplorar').addEventListener('click', () => setTab('explorar'));
  el('btnOptimizar').addEventListener('click', onOptimizar);
  el('btnGuardar').addEventListener('click', onGuardar);
  el('btnVaciar').addEventListener('click', onVaciar);
  el('btnCuenta').addEventListener('click', onCuenta);
  el('btnGuardadasLogin').addEventListener('click', () => openLogin());
  el('btnAdmin').addEventListener('click', onAdmin);

  el('btnCerrarAdmin').addEventListener('click', () => el('dlgAdmin').close());
  el('btnCancelLogin').addEventListener('click', () => el('dlgLogin').close());
  el('btnCancelGuardar').addEventListener('click', () => el('dlgGuardar').close());

  el('formLogin').addEventListener('submit', onSubmitLogin);
  el('formGuardar').addEventListener('submit', onSubmitGuardar);

  // Cualquier error no controlado llega aqui: el usuario siempre ve que algo fallo.
  window.addEventListener('unhandledrejection', (e) => {
    toast(e.reason?.message || 'Ocurrió un error inesperado.', { error: true });
  });
}

async function init() {
  bindEvents();
  initMap();
  setTab('explorar');

  const [types, session] = await Promise.all([api('/types'), api('/session')]);
  state.types = types;
  state.user = session.user;

  renderChips();
  renderAccount();
  await recargarLugares();
  await cargarRutasGuardadas();
}

init();

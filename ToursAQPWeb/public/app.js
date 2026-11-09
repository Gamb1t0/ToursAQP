const AREQUIPA_CENTER = [-16.409, -71.5375];

const MIN_POR_KM_CAMINANDO = 12; // ~5 km/h
const MAX_KM_CAMINANDO = 15;

const CATEGORY_EMOJI = {
  'Histórico': '🏛️',
  'Cultural': '🎭',
  'Natural': '🌋',
  'Comercial': '🛍️',
  'Educativo': '📚',
  'Restaurantes': '🍽️',
  'Entretenimiento': '🎉',
};

const state = {
  selected: [],           // {id, code, label, desc, category, lat, lon} en orden de seleccion
  highlightPath: null,    // {order: [ids]} ruta optima calculada
  mode: 'empty',          // 'empty' | 'selection' | 'all' | 'saved'
  allNodes: [],
  savedNodes: [],
  savedEdges: [],
  user: null,
};

let map, layerGroup;

const el = (id) => document.getElementById(id);

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

function categoryEmoji(cat) {
  return CATEGORY_EMOJI[cat] || '📍';
}

async function api(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de servidor');
  return data;
}

// ===== Mapa (Leaflet) =====

function initMap() {
  map = L.map('mapaCanvas', { zoomControl: true }).setView(AREQUIPA_CENTER, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);
  layerGroup = L.layerGroup().addTo(map);
}

function popupHtml(p) {
  const emoji = categoryEmoji(p.category);
  const cat = p.category ? `<span class="popup-cat">${escapeHtml(p.category)}</span>` : '';
  const desc = p.desc ? `<p>${escapeHtml(p.desc)}</p>` : '';
  return `<strong>${emoji} ${escapeHtml(p.label)}</strong> ${cat}${desc}`;
}

function popupContent(p) {
  const container = document.createElement('div');
  container.innerHTML = popupHtml(p);

  if (state.mode === 'all') {
    const btn = document.createElement('button');
    btn.className = 'popup-add';
    btn.textContent = 'Agregar a mi ruta';
    btn.onclick = () => addSelected(p);
    container.appendChild(btn);
  }
  return container;
}

function activePoints() {
  if (state.mode === 'selection') return state.selected;
  if (state.mode === 'all') return state.allNodes;
  if (state.mode === 'saved') return state.savedNodes;
  return [];
}

function redraw() {
  const points = activePoints();
  layerGroup.clearLayers();

  const hasPoints = points.length > 0;
  el('mapaVacio').classList.toggle('hidden', hasPoints);
  el('mapaCanvas').classList.toggle('hidden', !hasPoints);
  if (!hasPoints) return;

  // Leaflet mide 0x0 mientras el contenedor esta oculto.
  map.invalidateSize({ animate: false });

  if (state.mode === 'selection' && points.length >= 2 && !state.highlightPath) {
    L.polyline(points.map((p) => [p.lat, p.lon]), { color: '#FFFF00', weight: 2 }).addTo(layerGroup);
  }

  if (state.mode === 'saved') {
    const byId = new Map(points.map((p) => [p.id, p]));
    for (const e of state.savedEdges) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (a && b) L.polyline([[a.lat, a.lon], [b.lat, b.lon]], { color: '#00FF66', weight: 3 }).addTo(layerGroup);
    }
  }

  if (state.mode === 'selection' && state.highlightPath) {
    const byId = new Map(points.map((p) => [p.id, p]));
    const latlngs = state.highlightPath.order
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((p) => [p.lat, p.lon]);
    L.polyline(latlngs, { color: '#00FF66', weight: 4 }).addTo(layerGroup);
  }

  for (const p of points) {
    L.circleMarker([p.lat, p.lon], {
      radius: 8,
      color: '#000000',
      weight: 1,
      fillColor: '#00FFFF',
      fillOpacity: 1,
    })
      .addTo(layerGroup)
      .bindPopup(popupContent(p));
  }

  map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon])), { padding: [40, 40], maxZoom: 17 });
}

function showInfo(html) {
  el('rutaInfo').innerHTML = html;
  el('rutaInfo').classList.remove('hidden');
}

function hideInfo() {
  el('rutaInfo').classList.add('hidden');
}

// ===== Seleccion de lugares =====

function renderSelected() {
  const container = el('ubicacionesLayout');
  container.innerHTML = '';
  for (const p of state.selected) {
    const item = document.createElement('div');
    item.className = 'selected-item';

    const span = document.createElement('span');
    span.textContent = `${categoryEmoji(p.category)} ${p.label}`;
    span.onclick = () => {
      map.setView([p.lat, p.lon], 17);
    };

    const btn = document.createElement('button');
    btn.textContent = 'X';
    btn.onclick = () => removeSelected(p.id);

    item.appendChild(span);
    item.appendChild(btn);
    container.appendChild(item);
  }
}

function addSelected(node) {
  if (state.selected.some((s) => s.id === node.id)) {
    alert('Ese lugar ya está en tu ruta');
    return;
  }
  state.selected.push(node);
  state.mode = 'selection';
  state.highlightPath = null;
  hideInfo();
  renderSelected();
  redraw();
}

function removeSelected(id) {
  state.selected = state.selected.filter((s) => s.id !== id);
  state.highlightPath = null;
  state.mode = state.selected.length > 0 ? 'selection' : 'empty';
  hideInfo();
  renderSelected();
  redraw();
}

function getNodosSeleccionados() {
  return state.selected.map((s) => s.id);
}

function getNodosParaGuardar() {
  return state.highlightPath ? state.highlightPath.order : getNodosSeleccionados();
}

// ===== Busqueda / filtro =====

function showResultsList(items) {
  const list = el('listaResultadosBusqueda');
  list.innerHTML = '';

  if (items.length === 0) {
    list.classList.add('hidden');
    return;
  }

  for (const item of items) {
    const row = document.createElement('div');
    row.innerHTML = `<strong>${categoryEmoji(item.category)} ${escapeHtml(item.label)}</strong>` +
      (item.desc ? `<small>${escapeHtml(item.desc)}</small>` : '');
    row.onclick = async () => {
      list.classList.add('hidden');
      const coords = await api(`/nodes/coords?ids=${item.id}`);
      if (coords[0] && coords[0].lat !== null) addSelected(coords[0]);
    };
    list.appendChild(row);
  }

  list.classList.remove('hidden');
}

async function onBuscar() {
  const texto = el('txtBuscar').value.trim();
  if (!texto) {
    el('listaResultadosBusqueda').classList.add('hidden');
    return;
  }
  showResultsList(await api(`/search?q=${encodeURIComponent(texto)}`));
}

async function onFiltrar() {
  const cat = el('comboCategoria').value;
  const results = await api(cat === '__ALL__' ? '/nodes' : `/nodes?type=${encodeURIComponent(cat)}`);
  showResultsList(results);
}

// ===== Recorridos =====

function onVerOriginal() {
  if (state.selected.length === 0) {
    alert('Aún no has agregado lugares.');
    return;
  }
  const lines = state.selected.map((s, i) => `${i + 1}. ${categoryEmoji(s.category)} ${escapeHtml(s.label)}`).join('<br>');
  showInfo(`<strong>Orden en que agregaste los lugares:</strong><br>${lines}`);
}

// La distancia es en linea recta: la real por calles siempre sera mayor.
function describirTiempo(metros) {
  const km = metros / 1000;
  if (km > MAX_KM_CAMINANDO) return 'demasiado lejos para caminar, considera usar transporte';
  return `al menos ${Math.round(km * MIN_POR_KM_CAMINANDO)} min caminando`;
}

async function onRutaMinima() {
  if (state.selected.length < 2) {
    alert('Selecciona al menos 2 lugares');
    return;
  }
  const { order, totalDistance } = await api('/route/compute', {
    method: 'POST',
    body: JSON.stringify({ nodeIds: getNodosSeleccionados() }),
  });

  const byId = new Map(state.selected.map((s) => [s.id, s]));
  const lines = order.map((id, i) => `${i + 1}. ${categoryEmoji(byId.get(id)?.category)} ${escapeHtml(byId.get(id)?.label || '')}`).join('<br>');
  const km = (totalDistance / 1000).toFixed(2);

  showInfo(
    `<strong>Ruta optimizada:</strong> ${km} km en línea recta &middot; ${describirTiempo(totalDistance)}<br>${lines}`
  );
  state.highlightPath = { order };
  state.mode = 'selection';
  redraw();
}

async function onVerTodosLosNodos() {
  state.allNodes = await api('/nodes/all');
  state.mode = 'all';
  hideInfo();
  redraw();
}

function onLimpiarMapa() {
  state.selected = [];
  state.highlightPath = null;
  state.mode = 'empty';
  hideInfo();
  renderSelected();
  redraw();
}

// ===== Rutas guardadas =====

async function cargarRutasGuardadas() {
  const routes = await api('/routes');
  const list = el('listaRutas');
  list.innerHTML = '';
  for (const r of routes) {
    const li = document.createElement('li');
    li.textContent = r.name;
    li.onclick = () => mostrarRutaSeleccionada(r.id);
    list.appendChild(li);
  }
}

async function mostrarRutaSeleccionada(id) {
  const data = await api(`/routes/${id}`);
  state.savedNodes = data.nodes.filter((n) => n.lat !== null);
  state.savedEdges = data.edges;
  state.mode = 'saved';
  hideInfo();
  redraw();
}

async function onGuardarRuta() {
  if (el('btnGuardar').disabled) {
    alert('Debes iniciar sesión como administrador para guardar rutas.');
    return;
  }
  if (state.selected.length < 2) {
    alert('Selecciona al menos 2 lugares');
    return;
  }

  el('guardarNombre').value = '';
  el('dlgGuardar').showModal();
}

// ===== Login =====

function actualizarUI() {
  if (state.user) {
    el('lblUsuario').textContent = `${state.user.nombreCompleto} (${state.user.role})`;
    el('lblUsuario').classList.add('logueado');
    el('btnLogin').textContent = 'Cerrar sesión';
    const esAdmin = state.user.role === 'admin';
    el('btnGuardar').disabled = !esAdmin;
    el('btnNodos').disabled = !esAdmin;
  } else {
    el('lblUsuario').textContent = 'No has iniciado sesión';
    el('lblUsuario').classList.remove('logueado');
    el('btnLogin').textContent = 'Iniciar sesión';
    el('btnGuardar').disabled = true;
    el('btnNodos').disabled = true;
  }
}

async function onLogout() {
  await api('/logout', { method: 'POST' });
  state.user = null;
  actualizarUI();
  await cargarRutasGuardadas();
  if (state.mode === 'saved') {
    state.savedNodes = [];
    state.savedEdges = [];
    state.mode = state.selected.length > 0 ? 'selection' : 'empty';
    redraw();
  }
}

function onLogin() {
  if (state.user) {
    onLogout();
    return;
  }
  el('loginError').classList.add('hidden');
  el('loginUser').value = '';
  el('loginPass').value = '';
  el('dlgLogin').showModal();
}

// ===== Administrar nodos =====

async function onNodos() {
  const nodos = await api('/admin/nodes');
  const types = await api('/types');
  const tbody = document.querySelector('#tablaNodos tbody');
  tbody.innerHTML = '';

  for (const n of nodos) {
    const tr = document.createElement('tr');

    const fields = ['code', 'label', 'desc', 'ubication'];
    tr.innerHTML = `<td>${n.id}</td>` +
      fields.map((f) => `<td><input data-field="${f}" value="${escapeHtml((n[f] ?? '').toString())}"></td>`).join('');

    const tipoTd = document.createElement('td');
    const select = document.createElement('select');
    for (const t of types) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      if (t.id === n.type_id) opt.selected = true;
      select.appendChild(opt);
    }
    select.dataset.field = 'type_id';
    tipoTd.appendChild(select);
    tr.appendChild(tipoTd);

    const accionTd = document.createElement('td');
    const btnSave = document.createElement('button');
    btnSave.textContent = 'Guardar';
    btnSave.onclick = async () => {
      const payload = { type_id: Number(select.value) };
      tr.querySelectorAll('input[data-field]').forEach((inp) => {
        payload[inp.dataset.field] = inp.value;
      });
      await api(`/admin/nodes/${n.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      alert('Lugar actualizado');
    };
    accionTd.appendChild(btnSave);
    tr.appendChild(accionTd);

    tbody.appendChild(tr);
  }

  el('dlgNodos').showModal();
}

// ===== Inicializacion =====

async function init() {
  window.addEventListener('unhandledrejection', (e) => {
    alert(e.reason?.message || 'Ocurrió un error inesperado');
  });

  initMap();

  const types = await api('/types');
  const combo = el('comboCategoria');
  combo.innerHTML = '<option value="__ALL__">Todas las categorías</option>' +
    types.map((t) => `<option value="${escapeHtml(t.name)}">${categoryEmoji(t.name)} ${escapeHtml(t.name)}</option>`).join('');

  const session = await api('/session');
  state.user = session.user;
  actualizarUI();

  await cargarRutasGuardadas();
  redraw();

  el('btnBuscar').addEventListener('click', onBuscar);
  el('txtBuscar').addEventListener('keydown', (e) => { if (e.key === 'Enter') onBuscar(); });
  el('btnFiltrar').addEventListener('click', onFiltrar);
  el('btnRutaMinima').addEventListener('click', onRutaMinima);
  el('btnVerOriginal').addEventListener('click', onVerOriginal);
  el('btnVerTodos').addEventListener('click', onVerTodosLosNodos);
  el('btnLimpiar').addEventListener('click', onLimpiarMapa);
  el('btnGuardar').addEventListener('click', onGuardarRuta);
  el('btnLogin').addEventListener('click', onLogin);
  el('btnNodos').addEventListener('click', onNodos);
  el('btnCerrarNodos').addEventListener('click', () => el('dlgNodos').close());
  el('btnCancelLogin').addEventListener('click', () => el('dlgLogin').close());
  el('btnCancelGuardar').addEventListener('click', () => el('dlgGuardar').close());

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-row')) el('listaResultadosBusqueda').classList.add('hidden');
  });

  el('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const { user } = await api('/login', {
        method: 'POST',
        body: JSON.stringify({ username: el('loginUser').value, password: el('loginPass').value }),
      });
      state.user = user;
      actualizarUI();
      el('dlgLogin').close();
      await cargarRutasGuardadas();
    } catch (err) {
      el('loginError').textContent = err.message;
      el('loginError').classList.remove('hidden');
    }
  });

  el('formGuardar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = el('guardarNombre').value.trim();
    if (!nombre) return;
    try {
      await api('/routes', {
        method: 'POST',
        body: JSON.stringify({ name: nombre, nodeIds: getNodosParaGuardar() }),
      });
      el('dlgGuardar').close();
      await cargarRutasGuardadas();
      alert('Ruta guardada');
    } catch (err) {
      alert(err.message);
    }
  });
}

init();

# Tours AQP

Aplicación para planificar recorridos turísticos en Arequipa. El usuario puede buscar lugares, filtrarlos por categoría, seleccionarlos en un mapa y calcular diferentes recorridos sobre una red de ubicaciones. También incluye inicio de sesión y permite guardar rutas para consultarlas posteriormente.

> Las capturas de pantalla se agregarán en una próxima versión.

## Autor

**Alex Abdon Rhoddo Pacheco**

## Versión activa: Tours AQP Web

La versión que se mantiene activamente es la web, en [`ToursAQPWeb/`](ToursAQPWeb/). Se migró desde la versión original en Qt/C++ para no depender de instalar un SDK de Qt y poder trabajar directamente con Node.js y VS Code.

```bash
cd ToursAQPWeb
npm install
npm start
```

Luego abrir `http://localhost:3000`. Más detalles en [`ToursAQPWeb/README.md`](ToursAQPWeb/README.md).

### Tecnologías

- **Node.js** (`node:sqlite` nativo, sin dependencias de compilación) + **Express** en el backend.
- **SQLite** para lugares, usuarios y rutas.
- **HTML/CSS/JavaScript** en el frontend, con **Leaflet + OpenStreetMap** para el mapa y **OSRM** para las rutas por calles.
- Contraseñas con hash **PBKDF2-HMAC-SHA256** y sal por usuario.

### Funcionalidades principales

- Búsqueda al escribir y filtro por categoría, con todos los lugares visibles en la lista y en el mapa.
- Recorridos trazados por las calles reales (OSRM + OpenStreetMap), a pie o en auto, con distancia y tiempo por tramo.
- Orden más rápido de las paradas según tiempos reales (vecino más cercano + 2-opt), o reordenado a mano.
- Registro de cuentas gratuitas: cualquier visitante puede crear su cuenta y guardar sus rutas.
- Guardado, apertura y eliminación de rutas; cada usuario ve solo las suyas.
- Edición de lugares para administradores.

Las coordenadas de los 55 lugares se corrigieron con datos reales (geocodificación vía OpenStreetMap/Nominatim) — antes eran aproximaciones inventadas alrededor de un único punto. Se descartaron DFS y BFS como "recorridos": eran ejercicios de teoría de grafos sin utilidad real para planificar un tour, y quedó solo el cálculo de ruta optimizada.

## Hoja de ruta

Esta versión web es un paso intermedio entre un proyecto de portfolio y un producto que más gente pueda usar: al estar hospedada detrás de una URL (en vez de requerir instalar un ejecutable), es mucho más fácil compartirla. Si en el futuro se busca ofrecer el servicio a más personas en Arequipa, Perú u otros países, los pasos naturales serían:

- Desplegar el servidor en un hosting real (Render, Fly.io, un VPS, etc.) en vez de correrlo solo en local.
- Permitir cargar lugares y rutas de otras ciudades/países de forma configurable, en vez de tener las coordenadas de Arequipa fijas.
- Terminar de verificar manualmente las ~16 coordenadas aproximadas (negocios pequeños sin presencia en OpenStreetMap) con datos de campo reales.

## Versiones de escritorio (Qt/C++, archivadas)

El proyecto nació como una aplicación de escritorio en Qt. Esas versiones ya no se mantienen activamente, pero se conservan en el repositorio:

- [`ToursAQP2/`](ToursAQP2/): versión de escritorio más completa, en C++17/Qt 6. Requiere Qt Creator y un kit de Qt (MinGW 64-bit o MSVC 2022 64-bit) para compilarse.
- [`ToursAQP/`](ToursAQP/): versión anterior y más simple, previa a `ToursAQP2`.

Para compilar `ToursAQP2`:

```bash
cd ToursAQP2
qmake ToursAQP2.pro
mingw32-make   # o "make" fuera de Windows
```

La base de datos (`Tours.s3db`) se copia automáticamente junto al ejecutable al compilar, y los temas visuales (`.qss`) están empaquetados dentro del propio binario — no hace falta editar rutas a mano. Las contraseñas también usan PBKDF2-HMAC-SHA256 con sal por usuario.

## Estructura del repositorio

```text
ToursAQP/
├── README.md         # Este documento
├── ToursAQPWeb/       # Versión activa (Node.js + Express + SQLite)
├── ToursAQP2/         # Versión de escritorio Qt/C++ (archivada)
├── ToursAQP/          # Versión de escritorio anterior (archivada)
└── LICENSE
```

## Usuario de prueba

- Usuario: `admin`
- Contraseña: `admin123`
- Rol: administrador (puede editar lugares)

Para probar como turista, crea una cuenta desde la app con "Crear cuenta".

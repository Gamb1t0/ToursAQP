# Tours AQP — Web

Version web de Tours AQP: planificador de recorridos turisticos en Arequipa. Migrada desde la version de escritorio en Qt/C++ (`ToursAQP2/`) para no depender de instalar un SDK de Qt y poder desarrollarse con VS Code.

## Requisitos

- Node.js 22.5 o superior (usa el modulo nativo `node:sqlite`, sin dependencias de compilacion).

## Ejecucion

```bash
cd ToursAQPWeb
npm install
npm start
```

Abrir `http://localhost:3000` en el navegador.

Para desarrollo con reinicio automatico al guardar cambios:

```bash
npm run dev
```

## Estructura

```text
ToursAQPWeb/
├── server.js              # Punto de entrada: Express + sesiones
├── src/
│   ├── db.js               # Conexion a Tours.s3db (node:sqlite)
│   ├── auth.js             # Hash de contrasenas (PBKDF2-SHA256)
│   ├── geo.js               # Distancia haversine y parseo de coordenadas
│   ├── graph.js             # Ruta optima (vecino mas cercano)
│   └── routes/api.js        # Endpoints REST
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js               # UI: busqueda, mapa Leaflet, dialogos
└── data/Tours.s3db          # Base de datos SQLite (lugares, usuarios, rutas)
```

## Usuario de prueba

- Usuario: `admin`
- Contrasena: `admin123`
- Rol: administrador (puede guardar rutas y administrar nodos)

## Funcionalidades

- Busqueda y filtro de lugares por categoria (categorias cargadas desde la base de datos).
- Mapa real interactivo (Leaflet + OpenStreetMap) con marcadores, popups con descripcion/categoria, y zoom nativo.
- Calculo de ruta optima (vecino mas cercano) con distancia total y tiempo estimado caminando.
- Inicio de sesion con contrasenas hasheadas (PBKDF2-HMAC-SHA256, sal por usuario).
- Guardado y consulta de rutas (requiere rol administrador para guardar).
- Panel de administracion de nodos (editar lugares existentes).

## Notas

- La base de datos (`data/Tours.s3db`) es la misma que usaba la version de escritorio, ya migrada con contrasenas hasheadas.
- Las coordenadas de los lugares fueron corregidas con datos reales de OpenStreetMap (geocodificacion vía Nominatim). ~39 de 55 lugares quedaron verificados con una coincidencia exacta; el resto (negocios pequenos que OSM no indexa individualmente) usa una coordenada aproximada anclada al punto real mas cercano confirmado.
- Las sesiones usan un almacen en memoria (`express-session`); al reiniciar el servidor, los usuarios deben volver a iniciar sesion. Para produccion real, cambiar `SESSION_SECRET` por variable de entorno y usar un almacen de sesiones persistente.
- El mapa requiere conexion a internet (carga los tiles de OpenStreetMap).

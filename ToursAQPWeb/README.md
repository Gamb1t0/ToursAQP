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

Para ejecutar las pruebas (usan una copia temporal de la base de datos):

```bash
npm test
```

## Variables de entorno

| Variable | Uso | Valor por defecto |
| --- | --- | --- |
| `PORT` | Puerto del servidor | `3000` |
| `NODE_ENV` | Con `production` activa cookies `secure` y confia en el proxy HTTPS | - |
| `SESSION_SECRET` | Firma de las sesiones. **Obligatoria** con `NODE_ENV=production` | Secreto de desarrollo |
| `TOURS_DB_PATH` | Ruta del archivo SQLite | `data/Tours.s3db` |

## Estructura

```text
ToursAQPWeb/
├── server.js              # Punto de entrada: inicia el servidor
├── src/
│   ├── app.js              # Configuracion de Express, sesiones y errores
│   ├── db.js               # Conexion a Tours.s3db (node:sqlite)
│   ├── auth.js             # Hash de contrasenas (PBKDF2-SHA256)
│   ├── geo.js               # Distancia haversine y parseo de coordenadas
│   ├── graph.js             # Ruta optimizada (vecino mas cercano + 2-opt)
│   └── routes/api.js        # Endpoints REST
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js               # UI: busqueda, mapa Leaflet, dialogos
├── test/                    # Pruebas (node:test)
└── data/Tours.s3db          # Base de datos SQLite (lugares, usuarios, rutas)
```

## Usuario de prueba

- Usuario: `admin`
- Contrasena: `admin123`
- Rol: administrador (puede guardar rutas y administrar nodos)

## Funcionalidades

- Busqueda sin distinguir acentos ni mayusculas, y filtro de lugares por categoria (categorias cargadas desde la base de datos).
- Mapa real interactivo (Leaflet + OpenStreetMap) con marcadores, popups con descripcion/categoria, y zoom nativo. En "Ver todos los lugares" se pueden agregar lugares a la ruta desde el mapa.
- Ruta optimizada (vecino mas cercano + mejora 2-opt) que empieza en el primer lugar agregado, con distancia en linea recta y tiempo minimo caminando. Es una heuristica: da rutas muy buenas, pero no garantiza la optima.
- Inicio y cierre de sesion con contrasenas hasheadas (PBKDF2-HMAC-SHA256, sal por usuario) y bloqueo temporal tras 10 intentos fallidos.
- Guardado y consulta de rutas (requiere rol administrador para guardar; cada usuario solo ve las suyas). Si se optimizo la ruta, se guarda en ese orden.
- Panel de administracion de nodos (editar lugares existentes).

## Notas

- La base de datos (`data/Tours.s3db`) es la misma que usaba la version de escritorio, ya migrada con contrasenas hasheadas.
- Las coordenadas de los lugares fueron corregidas con datos reales de OpenStreetMap (geocodificacion vía Nominatim). ~39 de 55 lugares quedaron verificados con una coincidencia exacta; el resto (negocios pequenos que OSM no indexa individualmente) usa una coordenada aproximada anclada al punto real mas cercano confirmado.
- Las sesiones usan un almacen en memoria (`express-session`); al reiniciar el servidor, los usuarios deben volver a iniciar sesion. Para produccion real, definir `NODE_ENV=production` y `SESSION_SECRET`, usar un almacen de sesiones persistente y cambiar la contrasena del usuario de prueba `admin`, que es publica en este README.
- El mapa requiere conexion a internet (carga los tiles de OpenStreetMap).

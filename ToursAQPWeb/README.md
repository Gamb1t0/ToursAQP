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
| `ROUTING_FOOT_URL` | Servidor OSRM para rutas a pie | `https://routing.openstreetmap.de/routed-foot` |
| `ROUTING_CAR_URL` | Servidor OSRM para rutas en auto | `https://routing.openstreetmap.de/routed-car` |

## Estructura

```text
ToursAQPWeb/
├── server.js              # Punto de entrada: inicia el servidor
├── src/
│   ├── app.js              # Configuracion de Express, sesiones y errores
│   ├── db.js               # Conexion a Tours.s3db (node:sqlite)
│   ├── auth.js             # Hash de contrasenas (PBKDF2-SHA256)
│   ├── geo.js               # Distancia haversine y parseo de coordenadas
│   ├── graph.js             # Mejor orden de paradas (vecino mas cercano + 2-opt)
│   ├── routing.js           # Cliente de OSRM: rutas y tiempos por calles reales
│   └── routes/api.js        # Endpoints REST
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js               # UI: explorar, mi ruta, guardadas y mapa Leaflet
├── test/                    # Pruebas (node:test)
└── data/Tours.s3db          # Base de datos SQLite (lugares, usuarios, rutas)
```

## Usuario de prueba

- Usuario: `admin`
- Contrasena: `admin123`
- Rol: administrador (puede guardar rutas y administrar nodos)

## Funcionalidades

- **Explorar:** lista y mapa de todos los lugares, con busqueda al escribir (sin distinguir acentos ni mayusculas) y filtro por categoria. Se agregan a la ruta desde la lista o desde el mapa.
- **Mi ruta:** el recorrido se traza por las calles reales, a pie o en auto, con distancia y tiempo total y por tramo. Las paradas se pueden reordenar a mano, o con "Ordenar por la ruta mas rapida", que usa los tiempos reales por calles (vecino mas cercano + 2-opt) y mantiene la primera parada como punto de partida. Es una heuristica: da muy buenos resultados, pero no garantiza la optima.
- **Guardadas:** abrir y eliminar rutas guardadas. Guardar requiere rol administrador y cada usuario solo ve las suyas.
- Inicio y cierre de sesion con contrasenas hasheadas (PBKDF2-HMAC-SHA256, sal por usuario) y bloqueo temporal tras 10 intentos fallidos.
- Edicion de lugares para administradores.

## Notas

- La base de datos (`data/Tours.s3db`) es la misma que usaba la version de escritorio, ya migrada con contrasenas hasheadas.
- Las coordenadas de los lugares fueron corregidas con datos reales de OpenStreetMap (geocodificacion vía Nominatim). ~39 de 55 lugares quedaron verificados con una coincidencia exacta; el resto (negocios pequenos que OSM no indexa individualmente) usa una coordenada aproximada anclada al punto real mas cercano confirmado.
- Las sesiones usan un almacen en memoria (`express-session`); al reiniciar el servidor, los usuarios deben volver a iniciar sesion. Para produccion real, definir `NODE_ENV=production` y `SESSION_SECRET`, usar un almacen de sesiones persistente y cambiar la contrasena del usuario de prueba `admin`, que es publica en este README.
- El mapa y las rutas requieren conexion a internet. Si el servicio de rutas no responde, la app lo avisa y muestra una estimacion en linea recta.
- Las rutas usan los servidores publicos de OSRM de FOSSGIS sobre datos de OpenStreetMap, gratuitos y de uso limitado. Para un despliegue con muchos usuarios conviene hospedar un OSRM propio y configurarlo con `ROUTING_FOOT_URL` y `ROUTING_CAR_URL`.

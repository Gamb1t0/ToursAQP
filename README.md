# Tours AQP

Aplicación de escritorio para planificar recorridos turísticos en Arequipa. El usuario puede buscar lugares, filtrarlos por categoría, seleccionarlos en un mapa y calcular diferentes recorridos sobre una red de ubicaciones. También incluye inicio de sesión y permite guardar rutas para consultarlas posteriormente.

> Las capturas de pantalla se agregarán en una próxima versión. Por ahora, este documento incluye un instructivo breve de ejecución y uso.

## Autor

**Alex Abdon Rhoddo Pacheco**

## Tecnologías utilizadas

- **C++17**: lenguaje principal del proyecto.
- **Qt 6**: desarrollo de la interfaz gráfica de escritorio.
- **Qt Widgets**: ventanas, formularios, botones, listas y controles visuales.
- **Qt SQL**: conexión y consultas a la base de datos.
- **SQLite**: almacenamiento de usuarios, lugares, categorías y rutas.
- **QMake**: configuración y compilación del proyecto.
- **Qt Style Sheets (QSS)**: temas visuales claro, oscuro y moderno.

## Funcionalidades principales

- Búsqueda de lugares turísticos.
- Filtro de ubicaciones por categoría.
- Visualización de ubicaciones y recorridos en un mapa.
- Cálculo de ruta mínima.
- Recorridos mediante DFS y BFS.
- Visualización del recorrido original.
- Inicio de sesión de usuarios.
- Guardado y consulta de rutas.
- Zoom del mapa.
- Interfaz en español.

## Requisitos

- Qt 6.9 o una versión compatible.
- Compilador compatible con Qt, por ejemplo MinGW 64-bit o MSVC 2022 64-bit.
- Módulos de Qt: `Core`, `Gui`, `Widgets` y `Sql`.
- Controlador SQLite de Qt (`QSQLITE`).

## Ejecución

La versión principal se encuentra en la carpeta `ToursAQP2`.

1. Abrir Qt Creator.
2. Abrir el archivo `ToursAQP2/ToursAQP2.pro`.
3. Seleccionar un kit de Qt, como **Desktop Qt 6.9.0 MinGW 64-bit**.
4. Revisar las rutas de la base de datos y del tema visual en `ToursAQP2/database.cpp` y `ToursAQP2/main.cpp`.
5. Compilar el proyecto.
6. Ejecutar la aplicación.

También puede compilarse desde una terminal configurada con Qt:

```bash
cd ToursAQP2
qmake ToursAQP2.pro
make
```

En Windows, usando el kit MinGW de Qt, el último comando puede ser:

```bash
mingw32-make
```

## Instructivo de uso

1. Iniciar la aplicación.
2. Usar **Iniciar sesión** si se necesita acceder a las funciones de usuario.
3. Buscar un lugar en el campo **Buscar lugar...** y seleccionarlo de la lista.
4. Repetir el paso anterior para agregar los lugares del recorrido.
5. Usar **Aplicar filtro** para consultar lugares por categoría.
6. Elegir una opción de recorrido: **Ruta mínima**, **DFS**, **BFS** o **Ver recorrido original**.
7. Utilizar los controles `+` y `-` para acercar o alejar el mapa.
8. Guardar la ruta cuando el usuario tenga los permisos necesarios.
9. Consultar las rutas almacenadas desde el panel **Rutas guardadas**.

## Estructura del proyecto

```text
ToursAQP/
├── README.md                    # Documentación del proyecto
├── ToursAQP/                    # Versión anterior del proyecto
│   ├── ToursAQP.pro             # Configuración de QMake
│   ├── main.cpp                 # Punto de entrada
│   ├── toursaqp.cpp/.h          # Ventana principal
│   ├── database.cpp/.h          # Manejo de la base de datos
│   ├── NodosWindow.cpp/.h       # Ventana de nodos
│   ├── ToursAQP.ui              # Diseño de la interfaz
│   └── Tours.s3db               # Base de datos SQLite
├── ToursAQP2/                   # Versión principal y más completa
│   ├── ToursAQP2.pro            # Configuración de QMake
│   ├── main.cpp                 # Punto de entrada de la aplicación
│   ├── toursaqp.cpp/.h          # Ventana y lógica principal
│   ├── toursaqp.ui              # Diseño de la interfaz Qt
│   ├── database.cpp/.h          # Conexión con SQLite
│   ├── mapaview.cpp/.h          # Vista del mapa
│   ├── mapgraph.cpp/.h          # Grafo y conexiones entre nodos
│   ├── geoutils.cpp/.h          # Utilidades geográficas
│   ├── nodepainter.cpp/.h       # Dibujo de nodos del mapa
│   ├── nodoswindow.cpp/.h       # Ventana de gestión de nodos
│   ├── savedroutesmanager.cpp/.h # Guardado y carga de rutas
│   ├── usermanager.cpp/.h       # Inicio de sesión y usuarios
│   ├── utils.cpp/.h             # Funciones auxiliares
│   ├── Tours.s3db               # Base de datos SQLite
│   ├── ToursAQP2_es_PE.ts       # Traducciones al español
│   └── resources/styles/         # Temas visuales QSS
│       ├── dark.qss
│       ├── light.qss
│       └── modern.qss
└── build/                       # Archivos generados durante la compilación
```

## Base de datos y rutas locales

El proyecto incluye el archivo `Tours.s3db`. Antes de ejecutar la aplicación en otro equipo, se deben actualizar las rutas absolutas definidas en `ToursAQP2/database.cpp` y `ToursAQP2/main.cpp` para que apunten a la ubicación local de la base de datos y de los archivos `.qss`.

Los directorios `build/` contienen archivos generados por Qt y no son necesarios para comprender la estructura del código fuente.

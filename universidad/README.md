# Versiones universitarias (C++ / Qt)

Estas son las dos primeras versiones de Tours AQP, hechas como proyecto del curso **Lenguaje de Programación III** (cuarto semestre) en la **Universidad La Salle (Arequipa)**. Son aplicaciones de escritorio en C++ con Qt, centradas en algoritmos de grafos. Se conservan aquí como registro del origen del proyecto y ya no se mantienen.

La versión que se mantiene hoy es la web, en [`ToursAQPWeb/`](../ToursAQPWeb/). La desarrollé después por mi cuenta, fuera del curso.

| Carpeta | Qué es |
| --- | --- |
| [`ToursAQP/`](ToursAQP/) | Primera versión: un grafo de lugares recorrido con DFS, BFS y Dijkstra. |
| [`ToursAQP2/`](ToursAQP2/) | Segunda versión, más completa: mapa, filtros por categoría, inicio de sesión y rutas guardadas. C++17 y Qt 6. |

El estado exacto en que se entregaron está marcado con la etiqueta [`v1.0-universidad`](https://github.com/Gamb1t0/ToursAQP/tree/v1.0-universidad).

## Cambios posteriores al curso

En octubre de 2026, al migrar el proyecto a la web, también corregí en `ToursAQP2` cosas que la versión del curso no tenía:
- Contraseñas con hash PBKDF2-HMAC-SHA256 y sal por usuario, en vez de texto plano.
- Coordenadas reales de los lugares, tomadas de OpenStreetMap.
- Temas visuales (`.qss`) incluidos dentro del ejecutable.
- La base de datos se copia sola al compilar.

## Compilar `ToursAQP2`

Requiere Qt Creator y un kit de Qt 6 (MinGW 64-bit o MSVC 2022 64-bit).

```bash
cd universidad/ToursAQP2
qmake ToursAQP2.pro
mingw32-make   # o "make" fuera de Windows
```

Usuario de prueba: `admin` / `admin123`.

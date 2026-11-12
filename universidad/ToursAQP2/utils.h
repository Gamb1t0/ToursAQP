#ifndef UTILS_H
#define UTILS_H

#include <QString>

class Utils {
public:
    // convierte longitud (lon) a coordenada x en el mapa
    static double lonToX(double lon);

    // convierte latitud (lat) a coordenada y en el mapa
    static double latToY(double lat);

    // devuelve el nombre (label) del nodo segun su id
    static QString obtenerNombreNodo(int id);
};

#endif

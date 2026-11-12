#include "utils.h"
#include <QSqlQuery>

static const double minLat = -16.5;
static const double maxLat = -16.3;
static const double minLon = -71.6;
static const double maxLon = -71.45;

static const double ancho = 12000;
static const double alto  = 12000;

double Utils::lonToX(double lon) {
    return ((lon - minLon) / (maxLon - minLon)) * ancho;
}

double Utils::latToY(double lat) {
    return ((maxLat - lat) / (maxLat - minLat)) * alto;
}

QString Utils::obtenerNombreNodo(int id) {
    QSqlQuery q;
    q.prepare("SELECT label FROM nodes WHERE id = ?");
    q.addBindValue(id);
    if (q.exec() && q.next())
        return q.value(0).toString();
    return "Nodo";
}

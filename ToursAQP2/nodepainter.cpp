#include "nodepainter.h"
#include <QSqlQuery>
#include <QGraphicsEllipseItem>
#include <QGraphicsTextItem>
#include <QGraphicsRectItem>
#include <cmath>

void NodePainter::dibujarTodosLosNodos(QGraphicsScene* scene) {
    if (!scene) return;

    scene->clear();
    QSqlQuery q("SELECT id, label, ubication FROM nodes");

    double ancho = 9000, alto = 9000;
    double minLat = -16.5, maxLat = -16.3;
    double minLon = -71.6, maxLon = -71.45;

    while (q.next()) {
        QString label = q.value(1).toString();
        QStringList c = q.value(2).toString().split(",");
        if (c.size() != 2) continue;

        double lat = c[0].toDouble();
        double lon = c[1].toDouble();

        double x = ((lon - minLon) / (maxLon - minLon)) * ancho;
        double y = ((maxLat - lat) / (maxLat - minLat)) * alto;

        QGraphicsEllipseItem* punto = scene->addEllipse(
            x-5, y-5, 10, 10, QPen(), QBrush(Qt::cyan)
            );
        punto->setData(0, "nodo_base");
    }
}

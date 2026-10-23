#include "nodepainter.h"
#include "utils.h"
#include <QSqlQuery>
#include <QGraphicsEllipseItem>
#include <QGraphicsTextItem>

void NodePainter::dibujarTodosLosNodos(QGraphicsScene* scene) {
    if (!scene) return;

    scene->clear();
    QSqlQuery q("SELECT id, label, ubication FROM nodes");

    while (q.next()) {
        QString label = q.value(1).toString();
        QStringList c = q.value(2).toString().split(",");
        if (c.size() != 2) continue;

        bool okLat = false, okLon = false;
        double lat = c[0].toDouble(&okLat);
        double lon = c[1].toDouble(&okLon);
        if (!okLat || !okLon) continue;

        double x = Utils::lonToX(lon);
        double y = Utils::latToY(lat);

        QGraphicsEllipseItem* punto = scene->addEllipse(
            x-5, y-5, 10, 10, QPen(Qt::black), QBrush(Qt::cyan)
            );
        punto->setData(0, "nodo_base");

        QGraphicsTextItem* texto = scene->addText(label);
        texto->setDefaultTextColor(Qt::white);
        texto->setPos(x+8, y-8);
        texto->setData(0, "nodo_base_texto");
    }
}

#include "mapaview.h"
#include <QGraphicsEllipseItem>
#include <QGraphicsTextItem>
#include <QPen>

void MapaView::agregarNodo(QGraphicsScene* scene, int id, const QString& texto, QPointF pos) {
    if (!scene) return;

    QGraphicsEllipseItem* p = scene->addEllipse(
        pos.x()-6, pos.y()-6, 12, 12,
        QPen(Qt::black), QBrush(Qt::cyan)
        );
    p->setData(0, "nodo_" + QString::number(id));

    QGraphicsTextItem* t = scene->addText(texto);
    t->setPos(pos.x() + 10, pos.y() - 10);
    t->setData(0, "texto_" + QString::number(id));
}

void MapaView::eliminarNodo(QGraphicsScene* scene, int id) {
    if (!scene) return;

    for (auto* item : scene->items()) {
        QString d = item->data(0).toString();
        if (d == "nodo_" + QString::number(id) ||
            d == "texto_" + QString::number(id))
        {
            scene->removeItem(item);
            delete item;
        }
    }
}

void MapaView::mostrarRecorrido(QGraphicsScene* scene, const QVector<int>& ruta, const QString& tipo) {
    if (!scene || ruta.size() < 2) return;

    // ELIMINAR SOLO RECORRIDOS ANTERIORES
    QList<QGraphicsItem*> items = scene->items();
    for (auto* it : items) {
        QString d = it->data(0).toString();
        if (d.startsWith("recorrido_")) {
            scene->removeItem(it);
            delete it;
        }
    }

    // COLOR SEGÚN TIPO
    QPen pen;
    if (tipo == "DFS") pen = QPen(QColor("#FF4444"), 3);        // rojo
    if (tipo == "BFS") pen = QPen(QColor("#33B5E5"), 3);        // celeste
    if (tipo == "MINIMA") pen = QPen(QColor("#00FF66"), 3);     // verde

    // DIBUJAR NUEVO RECORRIDO
    for (int i = 0; i < ruta.size() - 1; i++) {
        QPointF a, b;

        for (auto* it : scene->items()) {
            QString d = it->data(0).toString();
            if (d == "nodo_" + QString::number(ruta[i]))
                a = it->sceneBoundingRect().center();
            if (d == "nodo_" + QString::number(ruta[i+1]))
                b = it->sceneBoundingRect().center();
        }

        QGraphicsLineItem* line = scene->addLine(QLineF(a, b), pen);
        line->setData(0, "recorrido_" + tipo);
    }
}

void MapaView::limpiarRecorridos(QGraphicsScene* scene)
{
    if (!scene) return;

    QList<QGraphicsItem*> borrar;
    for (auto* item : scene->items()) {
        QString d = item->data(0).toString();
        if (d.startsWith("recorrido")) {
            borrar << item;
        }
    }

    for (auto* i : borrar) {
        scene->removeItem(i);
        delete i;
    }
}

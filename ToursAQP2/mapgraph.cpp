#include "mapgraph.h"
#include "geoutils.h"
#include <QSqlQuery>
#include <QGraphicsLineItem>
#include <QGraphicsTextItem>
#include <QPen>

double MapGraph::distanciaEntreNodos(int id1, int id2) {
    QSqlQuery q1, q2;
    q1.prepare("SELECT ubication FROM nodes WHERE id = ?");
    q2.prepare("SELECT ubication FROM nodes WHERE id = ?");
    q1.addBindValue(id1);
    q2.addBindValue(id2);

    if (q1.exec() && q1.next() && q2.exec() && q2.next()) {
        QStringList c1 = q1.value(0).toString().split(",");
        QStringList c2 = q2.value(0).toString().split(",");

        if (c1.size() == 2 && c2.size() == 2) {
            return GeoUtils::haversine(
                c1[0].toDouble(), c1[1].toDouble(),
                c2[0].toDouble(), c2[1].toDouble()
                );
        }
    }
    return 0;
}

QHash<int, QVector<int>> MapGraph::construirGrafoCompleto(const QVector<int>& nodos) {
    QHash<int, QVector<int>> grafo;
    for (int a : nodos) {
        for (int b : nodos) {
            if (a != b) grafo[a].push_back(b);
        }
    }
    return grafo;
}

void MapGraph::generarEdges(QGraphicsScene* scene, const QVector<int>& nodos)
{
    if (!scene || nodos.size() < 2) return;

    // ===== 1. BORRAR LÍNEAS Y TEXTOS ANTERIORES =====
    QList<QGraphicsItem*> copia = scene->items();  // <- copia estable
    for (auto* it : copia) {
        QString tag = it->data(0).toString();
        if (tag.startsWith("edge") || tag.startsWith("edge_text")) {
            scene->removeItem(it);
            delete it;
        }
    }

    // ===== 2. OBTENER POSICIONES DE LOS NODOS =====
    QHash<int, QPointF> pos;

    // Usamos una copia CONGELADA de los items
    QList<QGraphicsItem*> items = scene->items(Qt::AscendingOrder);

    for (auto* it : items) {
        QString tag = it->data(0).toString();
        if (tag.startsWith("nodo_")) {
            int id = tag.split("_")[1].toInt();
            pos[id] = it->sceneBoundingRect().center();
        }
    }

    // si falta un nodo → no dibujar
    for (int id : nodos)
        if (!pos.contains(id))
            return;

    // ===== 3. DIBUJAR CONEXIÓN ENTRE NODOS ORDENADOS =====
    QPen pen(Qt::yellow, 2);

    for (int i = 0; i < nodos.size() - 1; i++) {
        int a = nodos[i];
        int b = nodos[i+1];

        QPointF pa = pos[a];
        QPointF pb = pos[b];

        // dibujar linea
        QGraphicsLineItem* line = scene->addLine(QLineF(pa, pb), pen);
        line->setData(0, "edge");

        // distancia
        double dist = distanciaEntreNodos(a, b);
        QPointF mid = (pa + pb) / 2;

        QGraphicsTextItem* txt = scene->addText(QString("%1 m").arg(dist, 0, 'f', 2));
        txt->setDefaultTextColor(Qt::yellow);
        txt->setPos(mid);
        txt->setData(0, "edge_text");
    }
}

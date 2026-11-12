#ifndef MAPGRAPH_H
#define MAPGRAPH_H

#include <QGraphicsScene>
#include <QVector>
#include <QHash>
#include <QPointF>

class MapGraph {

public:
    static void generarEdges(QGraphicsScene* scene, const QVector<int>& nodos);
    static double distanciaEntreNodos(int a, int b);
    static QHash<int,QVector<int>> construirGrafoCompleto(const QVector<int>& nodos);
};


#endif

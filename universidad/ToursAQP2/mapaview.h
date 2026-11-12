#ifndef MAPAVIEW_H
#define MAPAVIEW_H

#include <QGraphicsScene>
#include <QPointF>
#include <QString>
#include <QVector>

class MapaView {
public:
    static void agregarNodo(QGraphicsScene* scene, int id, const QString& texto, QPointF pos);
    static void eliminarNodo(QGraphicsScene* scene, int id);
    static void mostrarRecorrido(QGraphicsScene* scene, const QVector<int>& ruta, const QString& tipo);
    static void limpiarRecorridos(QGraphicsScene* scene);
};

#endif

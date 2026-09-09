#ifndef SAVEDROUTESMANAGER_H
#define SAVEDROUTESMANAGER_H

#include <QString>
#include <QVector>
#include <QListWidget>
#include <QGraphicsScene>
#include <QGraphicsView>

class SavedRoutesManager {
public:
    static bool guardarRuta(const QString& nombre, const QVector<int>& nodos);
    static void cargarRutas(QListWidget* lista);
    static void mostrarRutaEnMapa(QGraphicsScene* scene, QGraphicsView* view, QListWidgetItem* item);
};

#endif

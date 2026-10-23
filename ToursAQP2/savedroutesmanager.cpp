#include "savedroutesmanager.h"
#include "usermanager.h"
#include <QSqlQuery>
#include <QMessageBox>
#include <QGraphicsEllipseItem>
#include <QGraphicsLineItem>
#include "utils.h"

bool SavedRoutesManager::guardarRuta(const QString& nombre, const QVector<int>& nodos) {
    QSqlDatabase::database().transaction();
    QSqlQuery q;

    q.prepare("INSERT INTO user_routes (user_id, name) VALUES (?, ?)");
    q.addBindValue(UserManager::getUserId());
    q.addBindValue(nombre);

    if (!q.exec()) {
        QSqlDatabase::database().rollback();
        return false;
    }

    int idRuta = q.lastInsertId().toInt();

    for (int i=0;i<nodos.size()-1;i++) {
        q.prepare("INSERT INTO user_route_edges (user_route_id, from_node_id, to_node_id) VALUES (?, ?, ?)");
        q.addBindValue(idRuta);
        q.addBindValue(nodos[i]);
        q.addBindValue(nodos[i+1]);
        if (!q.exec()) {
            QSqlDatabase::database().rollback();
            return false;
        }
    }

    QSqlDatabase::database().commit();
    return true;
}

void SavedRoutesManager::cargarRutas(QListWidget* lista) {
    lista->clear();

    QSqlQuery q;
    q.prepare("SELECT id, name FROM user_routes WHERE user_id = ? ORDER BY created_at DESC");
    q.addBindValue(UserManager::getUserId());
    q.exec();

    while (q.next()) {
        QListWidgetItem* item = new QListWidgetItem(q.value(1).toString(), lista);
        item->setData(Qt::UserRole, q.value(0).toInt());
    }
}

void SavedRoutesManager::mostrarRutaEnMapa(QGraphicsScene* scene, QGraphicsView* view, QListWidgetItem* item) {
    if (!scene || !item) return;

    scene->clear();

    int routeId = item->data(Qt::UserRole).toInt();

    QVector<QPair<int,int>> edges;
    QSet<int> nodos;

    QSqlQuery q;
    q.prepare("SELECT from_node_id, to_node_id FROM user_route_edges WHERE user_route_id = ?");
    q.addBindValue(routeId);
    q.exec();

    while (q.next()) {
        int a = q.value(0).toInt();
        int b = q.value(1).toInt();
        edges.append({a,b});
        nodos.insert(a);
        nodos.insert(b);
    }

    QHash<int, QPointF> posiciones;

    for (int id : nodos) {
        QSqlQuery q2;
        q2.prepare("SELECT ubication FROM nodes WHERE id = ?");
        q2.addBindValue(id);
        q2.exec();
        if (!q2.next()) continue;

        QStringList c = q2.value(0).toString().split(",");
        double lat = c[0].toDouble();
        double lon = c[1].toDouble();

        double x = Utils::lonToX(lon);
        double y = Utils::latToY(lat);

        posiciones[id] = QPointF(x,y);

        // nodo
        QGraphicsEllipseItem* p =
            scene->addEllipse(x-6,y-6,12,12,QPen(Qt::white),QBrush(Qt::cyan));
        p->setData(0, "nodo");

        // texto
        QSqlQuery q3;
        q3.prepare("SELECT label FROM nodes WHERE id = ?");
        q3.addBindValue(id);
        q3.exec();
        q3.next();
        QString label = q3.value(0).toString();

        QGraphicsTextItem* t = scene->addText(label);
        t->setPos(x+10,y);
    }

    // edges
    QPen pen(Qt::green,3);
    for (auto e : edges) {
        scene->addLine(QLineF(posiciones[e.first], posiciones[e.second]),pen);
    }

    view->fitInView(scene->itemsBoundingRect(), Qt::KeepAspectRatio);
}

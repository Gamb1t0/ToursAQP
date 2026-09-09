#include "database.h"
#include <QSqlError>
#include <QDebug>
#include <QSqlQuery>
#include <QSqlRecord>
#include <QDir>


QSqlDatabase Database::db = QSqlDatabase();

bool Database::connect() {
    if (!QSqlDatabase::contains("qt_sql_default_connection")) {
        db = QSqlDatabase::addDatabase("QSQLITE");
    }

    // Usa la ruta absoluta al archivo real
    db.setDatabaseName("C:/Lp3/Lp3-25a/ToursAQP2/Tours.s3db");

    if (!db.open()) {
        qDebug() << "Error al conectar con la base de datos:" << db.lastError().text();
        return false;
    }

    qDebug() << "Conexión exitosa a la base de datos.";
    qDebug() << "Base de datos abierta:" << db.databaseName();
    qDebug() << "Ruta actual:" << QDir::currentPath();

    QSqlQuery query;
    if (query.exec("SELECT name FROM sqlite_master WHERE type='table'")) {
        qDebug() << "Tablas en la base de datos:";
        while (query.next()) {
            qDebug() << " - " << query.value(0).toString();
        }
    }

    return true;
}

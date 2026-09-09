#include "Database.h"
#include <QSqlError>
#include <QSqlQuery>
#include <QDir>
#include <QDebug>

QSqlDatabase Database::db = QSqlDatabase();

bool Database::connect() {
    if (!QSqlDatabase::contains("qt_sql_default_connection")) {
        db = QSqlDatabase::addDatabase("QSQLITE");
    }

    // ⚠️ Cambia esta ruta si tu archivo está en otra carpeta
    db.setDatabaseName("C:/Lp3/lp3-25a/ToursAQP/Tours.s3db");

    if (!db.open()) {
        qDebug() << "❌ Error al conectar con la base de datos:" << db.lastError().text();
        return false;
    }

    qDebug() << "✅ Conexión exitosa a la base de datos.";
    qDebug() << "📁 Archivo:" << db.databaseName();
    qDebug() << "📂 Carpeta actual:" << QDir::currentPath();

    QSqlQuery query;
    if (query.exec("SELECT name FROM sqlite_master WHERE type='table'")) {
        qDebug() << "📋 Tablas encontradas:";
        while (query.next()) {
            qDebug() << " - " << query.value(0).toString();
        }
    }

    return true;
}

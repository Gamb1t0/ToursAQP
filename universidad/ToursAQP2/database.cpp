#include "database.h"
#include <QSqlError>
#include <QDebug>
#include <QDir>
#include <QFile>
#include <QCoreApplication>

QSqlDatabase Database::db = QSqlDatabase();

QString Database::getDatabasePath() {
    return QDir(QCoreApplication::applicationDirPath()).filePath("Tours.s3db");
}

bool Database::connect() {
    if (!QSqlDatabase::contains("qt_sql_default_connection")) {
        db = QSqlDatabase::addDatabase("QSQLITE");
    }

    const QString dbPath = getDatabasePath();

    if (!QFile::exists(dbPath)) {
        qDebug() << "No se encontro la base de datos en:" << dbPath;
        return false;
    }

    db.setDatabaseName(dbPath);

    if (!db.open()) {
        qDebug() << "Error al conectar con la base de datos:" << db.lastError().text();
        return false;
    }

    qDebug() << "Conexion exitosa a la base de datos:" << dbPath;

    return true;
}

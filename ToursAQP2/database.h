#ifndef DATABASE_H
#define DATABASE_H


#include <QSqlDatabase>

class Database {
public:
    static QSqlDatabase db;
    static bool connect();
    static QString getDatabasePath();
};

#endif // DATABASE_H

#ifndef DATABASE_H
#define DATABASE_H

#include <QSqlDatabase>

class Database {
public:
    static QSqlDatabase db;
    static bool connect();
};

#endif // DATABASE_H

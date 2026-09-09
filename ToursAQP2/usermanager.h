#ifndef USERMANAGER_H
#define USERMANAGER_H

#include <QString>

class UserManager {
private:
    static QString usuario;
    static QString nombres;
    static QString apellidos;
    static QString rol;
    static int userId;

public:
    static bool login(const QString& user, const QString& pass);
    static QString getNombreCompleto();
    static QString getRol();
    static int getUserId();
    static bool estaLogueado();
};

#endif

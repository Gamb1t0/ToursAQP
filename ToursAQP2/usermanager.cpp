#include "usermanager.h"
#include <QSqlQuery>
#include <QSqlError>

QString UserManager::usuario = "";
QString UserManager::nombres = "";
QString UserManager::apellidos = "";
QString UserManager::rol = "";
int UserManager::userId = -1;

bool UserManager::login(const QString& user, const QString& pass) {
    QSqlQuery q;
    q.prepare("SELECT id, names, surnames, role FROM users WHERE username = ? AND password = ?");
    q.addBindValue(user);
    q.addBindValue(pass);

    if (!q.exec() || !q.next()) return false;

    userId = q.value(0).toInt();
    nombres = q.value(1).toString();
    apellidos = q.value(2).toString();
    rol = q.value(3).toString();
    usuario = user;

    return true;
}

QString UserManager::getNombreCompleto() {
    return nombres + " " + apellidos;
}

QString UserManager::getRol() {
    return rol;
}

int UserManager::getUserId() {
    return userId;
}

bool UserManager::estaLogueado() {
    return userId != -1;
}

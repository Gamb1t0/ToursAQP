#include "usermanager.h"
#include "passwordutils.h"
#include <QSqlQuery>
#include <QSqlError>

QString UserManager::usuario = "";
QString UserManager::nombres = "";
QString UserManager::apellidos = "";
QString UserManager::rol = "";
int UserManager::userId = -1;

bool UserManager::login(const QString& user, const QString& pass) {
    QSqlQuery q;
    q.prepare("SELECT id, names, surnames, role, password_hash, salt FROM users WHERE username = ?");
    q.addBindValue(user);

    if (!q.exec() || !q.next()) return false;

    const QString storedHash = q.value(4).toString();
    const QString salt = q.value(5).toString();

    if (salt.isEmpty() || PasswordUtils::hashPassword(pass, salt) != storedHash)
        return false;

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

#ifndef PASSWORDUTILS_H
#define PASSWORDUTILS_H

#include <QString>

class PasswordUtils {
public:
    static QString generateSalt();
    static QString hashPassword(const QString& password, const QString& saltHex);
};

#endif // PASSWORDUTILS_H

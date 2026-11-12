#include "passwordutils.h"
#include <QPasswordDigestor>
#include <QRandomGenerator>
#include <QCryptographicHash>

namespace {
constexpr int kIterations = 100000;
constexpr int kKeyLengthBytes = 32;
constexpr int kSaltBytes = 16;
}

QString PasswordUtils::generateSalt() {
    QByteArray salt(kSaltBytes, Qt::Uninitialized);
    for (int i = 0; i < kSaltBytes; ++i)
        salt[i] = static_cast<char>(QRandomGenerator::global()->bounded(256));
    return QString::fromLatin1(salt.toHex());
}

QString PasswordUtils::hashPassword(const QString& password, const QString& saltHex) {
    const QByteArray salt = QByteArray::fromHex(saltHex.toLatin1());
    const QByteArray hash = QPasswordDigestor::deriveKeyPbkdf2(
        QCryptographicHash::Sha256, password.toUtf8(), salt, kIterations, kKeyLengthBytes);
    return QString::fromLatin1(hash.toHex());
}

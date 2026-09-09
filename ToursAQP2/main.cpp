#include "toursaqp.h"
#include "Database.h"
#include <QApplication>
#include <QFile>
#include <QDebug>

void aplicarTema(const QString &ruta) {
    QFile styleFile(ruta);
    if (styleFile.open(QFile::ReadOnly)) {
        QString style = QLatin1String(styleFile.readAll());
        qApp->setStyleSheet(style);
    } else {
        qDebug() << "No se pudo cargar el tema:" << ruta;
    }
}

int main(int argc, char *argv[]) {
    QApplication app(argc, argv);

    if (!Database::connect()) return -1;

    // Aplica tema oscuro por defecto
    aplicarTema("C:/Lp3/Lp3-25a/ToursAQP2/resources/styles/dark.qss");

    ToursAQP ventana;
    ventana.show();

    return app.exec();
}

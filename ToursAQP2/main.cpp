#include "toursaqp.h"
#include "Database.h"
#include <QApplication>
#include <QFile>
#include <QDebug>
#include <QMessageBox>

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

    if (!Database::connect()) {
        QMessageBox::critical(nullptr, "Error de base de datos",
            "No se pudo conectar con la base de datos.\n"
            "Verifique que el archivo Tours.s3db este junto al ejecutable:\n"
            + Database::getDatabasePath());
        return -1;
    }

    // Aplica tema oscuro por defecto (empaquetado en el ejecutable)
    aplicarTema(":/styles/dark.qss");

    ToursAQP ventana;
    ventana.show();

    return app.exec();
}

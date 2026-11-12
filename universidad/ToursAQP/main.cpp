#include <QApplication>
#include "ToursAQP.h"
#include "Database.h"

int main(int argc, char *argv[]) {
    QApplication app(argc, argv);

    if (!Database::connect()) {
        return -1;
    }

    ToursAQP ventana;
    ventana.show();

    return app.exec();
}

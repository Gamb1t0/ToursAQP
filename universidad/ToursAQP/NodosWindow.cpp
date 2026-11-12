#include "NodosWindow.h"
#include <QVBoxLayout>
#include <QSqlError>
#include <QDebug>

NodosWindow::NodosWindow(QWidget* parent) : QDialog(parent) {
    setWindowTitle("Lista de Nodos");
    resize(500, 400);

    tableView = new QTableView(this);
    model = new QSqlTableModel(this);
    model->setTable("nodes");
    model->select();

    model->setHeaderData(0, Qt::Horizontal, "ID");
    model->setHeaderData(1, Qt::Horizontal, "Código");
    model->setHeaderData(2, Qt::Horizontal, "Nombre");
    model->setHeaderData(3, Qt::Horizontal, "Descripción");
    model->setHeaderData(4, Qt::Horizontal, "Ubicación");
    model->setHeaderData(5, Qt::Horizontal, "Tipo");
    model->setHeaderData(6, Qt::Horizontal, "Latitud");
    model->setHeaderData(7, Qt::Horizontal, "Longitud");

    tableView->setModel(model);
    tableView->resizeColumnsToContents();

    QVBoxLayout* layout = new QVBoxLayout(this);
    layout->addWidget(tableView);
}

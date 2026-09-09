#include "nodoswindow.h"

#include <QVBoxLayout>
#include <QSqlDatabase>
#include <QSqlError>
#include <QDebug>

NodosWindow::NodosWindow(QWidget* parent) : QDialog(parent) {
    setWindowTitle("Lista de Nodos");
    resize(500, 400);

    tableView = new QTableView(this);
    model = new QSqlTableModel(this);
    model->setTable("nodes");  // Asegúrate que tu tabla se llama 'nodes'
    model->select();

    model->setHeaderData(0, Qt::Horizontal, "ID");
    model->setHeaderData(1, Qt::Horizontal, "Code");
    model->setHeaderData(2, Qt::Horizontal, "Label");

    tableView->setModel(model);
    tableView->resizeColumnsToContents();

    QVBoxLayout* layout = new QVBoxLayout(this);
    layout->addWidget(tableView);
}

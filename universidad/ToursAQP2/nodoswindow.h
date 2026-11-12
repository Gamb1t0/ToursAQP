#ifndef NODOSWINDOW_H
#define NODOSWINDOW_H

#include <QDialog>
#include <QTableView>
#include <QSqlTableModel>

class NodosWindow : public QDialog {
    Q_OBJECT

public:
    explicit NodosWindow(QWidget* parent = nullptr);

private:
    QTableView* tableView;
    QSqlTableModel* model;
};
#endif // NODOSWINDOW_H

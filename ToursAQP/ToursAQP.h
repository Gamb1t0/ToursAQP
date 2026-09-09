#ifndef TOURSAQP_H
#define TOURSAQP_H

#include <QWidget>
#include <QGraphicsView>
#include <QGraphicsScene>
#include <QComboBox>
#include <QListWidget>
#include <QPushButton>
#include <QLabel>
#include <QLineEdit>
#include <QScrollArea>
#include <QVBoxLayout>
#include <QStack>
#include <QQueue>
#include <QHash>
#include <QVector>

class ToursAQP : public QWidget {
    Q_OBJECT

public:
    explicit ToursAQP(QWidget* parent = nullptr);

private slots:
    void onBuscar();
    void onFiltrar();
    void onRutaMinima();
    void onDFS();
    void onBFS();
    void onLogin();
    void onZoomIn();
    void onZoomOut();
    void onUbicarme();
    void onGuardarRuta();
    void agregarUbicacionDesdeBusqueda(QListWidgetItem* item);
    void mostrarRutaSeleccionada(QListWidgetItem* item);

private:
    void dibujarNodosBase();
    void generarEdges();
    QVector<int> getNodosSeleccionados();
    void cargarRutasGuardadas();
    void actualizarAparienciaNodosSeleccionados();

    // UI
    QComboBox* comboZona;
    QComboBox* comboCategoria;
    QListWidget* listaRutas;
    QLineEdit* txtBuscar;
    QPushButton* btnRutaMinima;
    QPushButton* btnGuardar;
    QGraphicsScene* mapaScene;
    QGraphicsView* mapaView;
    QLabel* lblUsuario;

    // Lista con scroll
    QWidget* contenedorUbicaciones;
    QVBoxLayout* ubicacionesLayout;
    QScrollArea* scrollUbicaciones;

    QListWidget* listaResultadosBusqueda;
    QHash<QString, int> nodosDisponibles;
};

#endif // TOURSAQP_H

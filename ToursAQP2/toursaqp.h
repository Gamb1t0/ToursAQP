#ifndef TOURSAQP_H
#define TOURSAQP_H

#include <QWidget>
#include <QGraphicsScene>
#include <QGraphicsView>
#include <QComboBox>
#include <QListWidget>
#include <QLabel>
#include <QLineEdit>
#include <QVBoxLayout>
#include <QPushButton>
#include <QStack>
#include <QQueue>

class ToursAQP : public QWidget {
    Q_OBJECT

public:
    explicit ToursAQP(QWidget* parent = nullptr);

protected:
    void resizeEvent(QResizeEvent *event) override;
    void showEvent(QShowEvent* event) override;

private slots:
    void onBuscar();
    void agregarUbicacionDesdeBusqueda(QListWidgetItem* item);
    void onFiltrar();
    void onZoomIn();
    void onZoomOut();
    void onLogin();
    void onDFS();
    void onBFS();
    void onRutaMinima();
    void onGuardarRuta();
    void mostrarRutaSeleccionada(QListWidgetItem* item);
    void onNodos();
    void onVerTodosLosNodos();
    void cargarRutasGuardadas();
    double calcularDistanciaEntreNodos(int id1, int id2);
    void onVerOriginal();
    void onLimpiarMapa();

private:
    QVector<int> ordenOriginal;
    QVector<int> ultimoRecorrido;
    QString ultimoTipo;
    QVector<int> getNodosSeleccionados();
    void ajustarVistaMapa(int margen = 40);
    QComboBox* comboCategoria;
    QListWidget* listaRutas;
    QLineEdit* txtBuscar;
    QPushButton* btnRutaMinima;
    QPushButton* btnGuardar;
    QPushButton* btnNodos;
    QGraphicsScene* mapaScene;
    QGraphicsView* mapaView;
    QLabel* lblUsuario;
    QVBoxLayout* ubicacionesLayout;

    QListWidget* listaResultadosBusqueda;
    QHash<QString, int> nodosDisponibles;
};

#endif

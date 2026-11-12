// =============================================================
//  ToursAQP.h
// =============================================================
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
    // construcción UI / carga
    void dibujarNodosBase();
    void cargarRutasGuardadas();

    // nodos seleccionados
    QVector<int> getNodosSeleccionados();
    void actualizarAparienciaNodosSeleccionados();
    void generarEdgesEntreSeleccionados();

    // helpers de dibujo
    QPointF coordToScene(double lat, double lon) const;
    void dibujarNodoSeleccionado(int id, const QString& label);
    void dibujarLinea(const QPointF& a, const QPointF& b, const QColor& c = Qt::green, int w = 3);
    void dibujarEtiqueta(const QPointF& p, const QString& txt, const QColor& c = Qt::white);

    // algoritmos
    void visualizarRecorrido(const QVector<int>& recorrido, const QString& titulo);
    QHash<int, QHash<int, double>> construirGrafoDesdeEdges();
    QVector<int> reconstruirCamino(int start, int goal,
                                   const QHash<int,int>& prev);

private:
    // UI principal
    QComboBox* comboZona;
    QComboBox* comboCategoria;
    QListWidget* listaRutas;
    QLineEdit* txtBuscar;
    QPushButton* btnRutaMinima;
    QPushButton* btnGuardar;
    QGraphicsScene* mapaScene;
    QGraphicsView* mapaView;
    QLabel* lblUsuario;
    QListWidget* listaResultadosBusqueda;

    // lista de nodos seleccionados (con scroll)
    QWidget* contenedorUbicaciones;
    QVBoxLayout* ubicacionesLayout;
    QScrollArea* scrollUbicaciones;

    // para mapear "texto mostrado" -> id de nodo
    QHash<QString, int> nodosDisponibles;
};

#endif // TOURSAQP_H


// =============================================================
//  ToursAQP.cpp
// =============================================================
#include "ToursAQP.h"
#include "NodosWindow.h"

#include <QHBoxLayout>
#include <QSqlQuery>
#include <QSqlError>
#include <QMessageBox>
#include <QTimer>
#include <QFormLayout>
#include <QDialog>
#include <QDialogButtonBox>
#include <QInputDialog>
#include <QGraphicsEllipseItem>
#include <QGraphicsTextItem>
#include <QRandomGenerator>
#include <QStack>
#include <QQueue>
#include <QSet>
#include <queue>
#include <limits>
#include <cmath>

// =============================================================
//  Constructor
// =============================================================
ToursAQP::ToursAQP(QWidget* parent)
    : QWidget(parent),
    comboZona(new QComboBox(this)),
    comboCategoria(new QComboBox(this)),
    listaRutas(new QListWidget(this)),
    txtBuscar(new QLineEdit(this)),
    btnRutaMinima(new QPushButton("Ruta mínima", this)),
    btnGuardar(new QPushButton("Guardar Ruta", this)),
    mapaScene(new QGraphicsScene(this)),
    mapaView(new QGraphicsView(this)),
    lblUsuario(new QLabel("No ha iniciado sesión", this)),
    listaResultadosBusqueda(new QListWidget(this))
{
    // ================== LAYOUT PRINCIPAL ==================
    QHBoxLayout* mainLayout = new QHBoxLayout(this);

    // ================== PANEL IZQUIERDO ==================
    QVBoxLayout* leftPanel = new QVBoxLayout();
    comboZona->addItem("Todas las zonas");
    comboZona->addItems({"Centro", "Yanahuara", "Cayma", "Externo"});

    comboCategoria->addItem("Todas las categorías");
    comboCategoria->addItems({"Histórico", "Cultural", "Natural", "Comercial",
                              "Educativo", "Restaurantes", "Entretenimiento"});

    QPushButton* btnFiltrar = new QPushButton("Filtrar", this);

    leftPanel->addWidget(comboZona);
    leftPanel->addWidget(comboCategoria);
    leftPanel->addWidget(btnFiltrar);
    leftPanel->addSpacing(15);
    leftPanel->addWidget(new QLabel("Rutas guardadas:", this));
    leftPanel->addWidget(listaRutas);

    mainLayout->addLayout(leftPanel);

    // ================== PANEL CENTRAL ==================
    QVBoxLayout* centerPanel = new QVBoxLayout();

    QLabel* titulo = new QLabel("Tours AQP", this);
    titulo->setStyleSheet("font-size: 24px; font-weight: bold;");
    centerPanel->addWidget(titulo, 0, Qt::AlignHCenter);

    // --- buscador
    QHBoxLayout* buscadorLayout = new QHBoxLayout();
    txtBuscar->setPlaceholderText("Buscar lugar turístico...");
    QPushButton* btnBuscar = new QPushButton("🔍", this);
    buscadorLayout->addWidget(txtBuscar);
    buscadorLayout->addWidget(btnBuscar);
    centerPanel->addLayout(buscadorLayout);

    // resultados de búsqueda
    listaResultadosBusqueda->setVisible(false);
    listaResultadosBusqueda->setStyleSheet(
        "QListWidget { border: 1px solid #444; border-radius: 4px; }"
        "QListWidget::item { padding: 4px; }"
        "QListWidget::item:hover { background: #333; }"
        );
    centerPanel->addWidget(listaResultadosBusqueda);

    // --- listado de ubicaciones elegidas (con scroll)
    QLabel* lblUbicaciones = new QLabel("Ubicaciones seleccionadas:", this);
    centerPanel->addWidget(lblUbicaciones);

    contenedorUbicaciones = new QWidget(this);
    ubicacionesLayout = new QVBoxLayout(contenedorUbicaciones);
    ubicacionesLayout->setAlignment(Qt::AlignTop);

    scrollUbicaciones = new QScrollArea(this);
    scrollUbicaciones->setWidget(contenedorUbicaciones);
    scrollUbicaciones->setWidgetResizable(true);
    scrollUbicaciones->setMinimumHeight(140);
    scrollUbicaciones->setMaximumHeight(230);
    scrollUbicaciones->setStyleSheet("QScrollArea { border: 1px solid #444; }");

    centerPanel->addWidget(scrollUbicaciones);

    // --- mapa
    mapaView->setScene(mapaScene);
    mapaView->setMinimumSize(700, 450);
    centerPanel->addWidget(mapaView);

    // --- botones abajo
    QHBoxLayout* botonesLayout = new QHBoxLayout();
    QPushButton* btnUbicarme = new QPushButton("Ubicarme", this);
    QPushButton* btnDFS = new QPushButton("DFS", this);
    QPushButton* btnBFS = new QPushButton("BFS", this);
    botonesLayout->addWidget(btnGuardar);
    botonesLayout->addWidget(btnUbicarme);
    botonesLayout->addWidget(btnRutaMinima);
    botonesLayout->addWidget(btnDFS);
    botonesLayout->addWidget(btnBFS);

    centerPanel->addLayout(botonesLayout);

    mainLayout->addLayout(centerPanel);

    // ================== PANEL DERECHO ==================
    QVBoxLayout* rightPanel = new QVBoxLayout();
    QPushButton* btnLogin = new QPushButton("Iniciar sesión", this);
    QLabel* lblZoom = new QLabel("Zoom:", this);
    QPushButton* btnZoomIn = new QPushButton("+", this);
    QPushButton* btnZoomOut = new QPushButton("-", this);

    rightPanel->addWidget(lblUsuario);
    rightPanel->addWidget(btnLogin);
    rightPanel->addSpacing(10);
    rightPanel->addWidget(lblZoom);
    rightPanel->addWidget(btnZoomIn);
    rightPanel->addWidget(btnZoomOut);
    rightPanel->addStretch();

    mainLayout->addLayout(rightPanel);

    // ================== ESTILOS ==================
    txtBuscar->setStyleSheet(
        "QLineEdit { padding: 5px; border: 1px solid #555; border-radius: 4px; }");
    btnGuardar->setStyleSheet(
        "QPushButton { background:#28a745; color:white; border-radius:4px; }"
        "QPushButton:hover { background:#238636; }");

    // ================== CONEXIONES ==================
    connect(btnBuscar, &QPushButton::clicked, this, &ToursAQP::onBuscar);
    connect(txtBuscar, &QLineEdit::returnPressed, this, &ToursAQP::onBuscar);
    connect(btnFiltrar, &QPushButton::clicked, this, &ToursAQP::onFiltrar);
    connect(btnZoomIn, &QPushButton::clicked, this, &ToursAQP::onZoomIn);
    connect(btnZoomOut, &QPushButton::clicked, this, &ToursAQP::onZoomOut);
    connect(btnUbicarme, &QPushButton::clicked, this, &ToursAQP::onUbicarme);
    connect(btnLogin, &QPushButton::clicked, this, &ToursAQP::onLogin);
    connect(btnRutaMinima, &QPushButton::clicked, this, &ToursAQP::onRutaMinima);
    connect(btnDFS, &QPushButton::clicked, this, &ToursAQP::onDFS);
    connect(btnBFS, &QPushButton::clicked, this, &ToursAQP::onBFS);
    connect(btnGuardar, &QPushButton::clicked, this, &ToursAQP::onGuardarRuta);

    connect(listaResultadosBusqueda, &QListWidget::itemDoubleClicked,
            this, &ToursAQP::agregarUbicacionDesdeBusqueda);

    connect(listaRutas, &QListWidget::itemClicked,
            this, &ToursAQP::mostrarRutaSeleccionada);

    // ================== CARGA INICIAL ==================
    QTimer::singleShot(0, this, [this]() {
        dibujarNodosBase();
        cargarRutasGuardadas();
    });
}

// =============================================================
//  Convierte lat/lon a coordenadas de escena
// =============================================================
QPointF ToursAQP::coordToScene(double lat, double lon) const {
    // Tus datos son positivos en BD, pero el mapa lo queremos en un rango
    double x = (71.60 - std::fabs(lon)) * 8000.0;
    double y = (std::fabs(lat) - 16.30) * 8000.0;
    return QPointF(x, y);
}

// =============================================================
//  Dibuja nodos base (sin nombres)
// =============================================================
void ToursAQP::dibujarNodosBase() {
    mapaScene->clear();

    QSqlQuery query("SELECT id, label, latitude, longitude FROM nodes");
    while (query.next()) {
        int id = query.value("id").toInt();
        QString label = query.value("label").toString();
        double lat = query.value("latitude").toDouble();
        double lon = query.value("longitude").toDouble();

        QPointF p = coordToScene(lat, lon);

        QGraphicsEllipseItem* nodo = mapaScene->addEllipse(p.x()-4, p.y()-4, 8, 8,
                                                           QPen(Qt::darkGray),
                                                           QBrush(Qt::gray));
        nodo->setData(0, id);
        nodo->setOpacity(0.6);
        // NO ponemos texto aquí → solo cuando esté seleccionado
        Q_UNUSED(label);
    }

    mapaView->fitInView(mapaScene->sceneRect(), Qt::KeepAspectRatio);
}

// =============================================================
//  Buscar nodos por nombre
// =============================================================
void ToursAQP::onBuscar() {
    QString texto = txtBuscar->text().trimmed();
    listaResultadosBusqueda->clear();
    nodosDisponibles.clear();

    QSqlQuery query;
    query.prepare("SELECT id, label FROM nodes WHERE label LIKE ? LIMIT 25");
    query.addBindValue("%" + texto + "%");

    if (!query.exec()) {
        QMessageBox::critical(this, "Error", "Error en búsqueda: " + query.lastError().text());
        return;
    }

    while (query.next()) {
        int id = query.value(0).toInt();
        QString label = query.value(1).toString();
        listaResultadosBusqueda->addItem(label);
        nodosDisponibles[label] = id;
    }

    listaResultadosBusqueda->setVisible(true);
}

// =============================================================
//  Agregar ubicación desde búsqueda
// =============================================================
void ToursAQP::agregarUbicacionDesdeBusqueda(QListWidgetItem* item) {
    QString label = item->text();
    int idNodo = nodosDisponibles.value(label, -1);
    if (idNodo == -1) return;

    // evitar duplicados
    for (int i = 0; i < ubicacionesLayout->count(); ++i) {
        QWidget* fila = ubicacionesLayout->itemAt(i)->widget();
        if (!fila) continue;
        QLabel* l = fila->findChild<QLabel*>();
        if (l && l->text() == label) {
            QMessageBox::information(this, "Ubicación", "Este lugar ya está agregado");
            return;
        }
    }

    // crear fila
    QWidget* fila = new QWidget();
    QHBoxLayout* lay = new QHBoxLayout(fila);
    lay->setContentsMargins(0,0,0,0);
    QLabel* lbl = new QLabel(label);
    QPushButton* btnX = new QPushButton("X");
    btnX->setFixedSize(20,20);
    lay->addWidget(lbl);
    lay->addWidget(btnX);
    ubicacionesLayout->addWidget(fila);

    // eliminar
    connect(btnX, &QPushButton::clicked, this, [this, fila, label]() {
        fila->deleteLater();
        // al quitar uno, regeneramos conexión
        generarEdgesEntreSeleccionados();
    });

    // después de agregar, dibujamos todo
    generarEdgesEntreSeleccionados();

    // oculto lista
    listaResultadosBusqueda->clear();
    listaResultadosBusqueda->setVisible(false);
    txtBuscar->clear();
}

// =============================================================
//  Obtener lista de IDs de nodos seleccionados
// =============================================================
QVector<int> ToursAQP::getNodosSeleccionados() {
    QVector<int> ids;
    for (int i = 0; i < ubicacionesLayout->count(); ++i) {
        QWidget* fila = ubicacionesLayout->itemAt(i)->widget();
        if (!fila) continue;
        QLabel* lbl = fila->findChild<QLabel*>();
        if (!lbl) continue;
        QString texto = lbl->text();
        if (nodosDisponibles.contains(texto)) {
            ids << nodosDisponibles.value(texto);
        } else {
            // por si ya no está en el hash, lo buscamos por label
            QSqlQuery q;
            q.prepare("SELECT id FROM nodes WHERE label = ?");
            q.addBindValue(texto);
            if (q.exec() && q.next()) {
                ids << q.value(0).toInt();
            }
        }
    }
    return ids;
}

// =============================================================
//  Poner cara de "seleccionado" a los nodos elegidos
//  y oscurecer los demás
// =============================================================
void ToursAQP::actualizarAparienciaNodosSeleccionados() {
    QVector<int> seleccionados = getNodosSeleccionados();
    QList<QGraphicsItem*> items = mapaScene->items();

    for (QGraphicsItem* it : items) {
        auto* el = qgraphicsitem_cast<QGraphicsEllipseItem*>(it);
        if (!el) continue;
        int id = el->data(0).toInt();
        if (seleccionados.contains(id)) {
            // nodo seleccionado → bright + etiqueta
            el->setBrush(QBrush(Qt::cyan));
            el->setPen(QPen(Qt::blue, 2));
            el->setOpacity(1.0);

            // sacar label de BD
            QSqlQuery q;
            q.prepare("SELECT label, latitude, longitude FROM nodes WHERE id=?");
            q.addBindValue(id);
            if (q.exec() && q.next()) {
                QString label = q.value(0).toString();
                double lat = q.value(1).toDouble();
                double lon = q.value(2).toDouble();
                QPointF p = coordToScene(lat, lon);
                QGraphicsTextItem* txt = mapaScene->addText(label);
                txt->setDefaultTextColor(Qt::white);
                txt->setPos(p.x() + 8, p.y() - 12);
            }
        } else {
            // no seleccionado
            el->setBrush(QBrush(Qt::darkGray));
            el->setPen(QPen(Qt::gray, 1));
            el->setOpacity(0.25);
        }
    }
}

// =============================================================
//  Generar edges entre nodos seleccionados
// =============================================================
void ToursAQP::generarEdgesEntreSeleccionados() {
    // redibujar base
    dibujarNodosBase();

    QVector<int> ids = getNodosSeleccionados();
    if (ids.isEmpty()) {
        return;
    }

    // resaltar/atenuar
    actualizarAparienciaNodosSeleccionados();

    // si hay 2 o más → dibujar conexión
    if (ids.size() >= 2) {
        QPen pen(Qt::green, 3);
        for (int i = 0; i < ids.size() - 1; ++i) {
            int from = ids[i];
            int to   = ids[i+1];

            // sacar coords de cada uno
            QSqlQuery q;
            q.prepare("SELECT latitude, longitude FROM nodes WHERE id=?");
            q.addBindValue(from);
            q.exec(); q.next();
            double f_lat = q.value(0).toDouble();
            double f_lon = q.value(1).toDouble();
            QPointF pf = coordToScene(f_lat, f_lon);

            q.prepare("SELECT latitude, longitude FROM nodes WHERE id=?");
            q.addBindValue(to);
            q.exec(); q.next();
            double t_lat = q.value(0).toDouble();
            double t_lon = q.value(1).toDouble();
            QPointF pt = coordToScene(t_lat, t_lon);

            auto* line = mapaScene->addLine(QLineF(pf, pt), pen);
            line->setData(0, "edge");

            // poner distancia si hay en BD
            QSqlQuery qe;
            qe.prepare("SELECT value FROM edges WHERE "
                       "(from_node_id = ? AND to_node_id = ?) OR "
                       "(from_node_id = ? AND to_node_id = ?)");
            qe.addBindValue(from);
            qe.addBindValue(to);
            qe.addBindValue(to);
            qe.addBindValue(from);
            double valor = 0;
            if (qe.exec() && qe.next()) {
                valor = qe.value(0).toDouble();
            } else {
                // distancia euclidiana simulada
                valor = QLineF(pf, pt).length() / 100.0;
            }

            QGraphicsTextItem* tx = mapaScene->addText(QString("%1 m").arg(valor, 0, 'f', 1));
            tx->setPos((pf.x()+pt.x())/2, (pf.y()+pt.y())/2);
            tx->setDefaultTextColor(Qt::yellow);
            tx->setData(0, "edge_text");
        }
    }

    mapaView->fitInView(mapaScene->sceneRect(), Qt::KeepAspectRatio);
}

// =============================================================
//  Filtrar (por categoría)
// =============================================================
void ToursAQP::onFiltrar() {
    QString categoria = comboCategoria->currentText();
    listaResultadosBusqueda->clear();
    nodosDisponibles.clear();

    QString sql = "SELECT id, label FROM nodes";
    if (categoria != "Todas las categorías") {
        sql += " WHERE type_id = (SELECT id FROM types WHERE name = ?)";
    }

    QSqlQuery q;
    if (categoria != "Todas las categorías") {
        q.prepare(sql);
        q.addBindValue(categoria);
    } else {
        q.prepare(sql);
    }

    if (q.exec()) {
        while (q.next()) {
            int id = q.value(0).toInt();
            QString label = q.value(1).toString();
            listaResultadosBusqueda->addItem(label);
            nodosDisponibles[label] = id;
        }
        listaResultadosBusqueda->setVisible(true);
    }
}

// =============================================================
//  Zoom
// =============================================================
void ToursAQP::onZoomIn() {
    mapaView->scale(1.2, 1.2);
}
void ToursAQP::onZoomOut() {
    mapaView->scale(0.8, 0.8);
}

// =============================================================
//  Ubicarme
// =============================================================
void ToursAQP::onUbicarme() {
    const double lat = 16.3989;
    const double lon = 71.5369;
    QPointF p = coordToScene(lat, lon);
    mapaView->centerOn(p);

    auto* marker = mapaScene->addEllipse(p.x()-7, p.y()-7, 14, 14,
                                         QPen(Qt::red, 2),
                                         QBrush(Qt::red));
    marker->setZValue(10);
    auto* txt = mapaScene->addText("Ubicación actual");
    txt->setDefaultTextColor(Qt::red);
    txt->setPos(p.x()+10, p.y()-10);
}

// =============================================================
//  Login
// =============================================================
void ToursAQP::onLogin() {
    QDialog dlg(this);
    dlg.setWindowTitle("Iniciar sesión");
    QFormLayout* form = new QFormLayout();
    QLineEdit* user = new QLineEdit(&dlg);
    QLineEdit* pass = new QLineEdit(&dlg);
    pass->setEchoMode(QLineEdit::Password);
    form->addRow("Usuario:", user);
    form->addRow("Contraseña:", pass);
    QDialogButtonBox* box = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel);
    QObject::connect(box, &QDialogButtonBox::accepted, &dlg, &QDialog::accept);
    QObject::connect(box, &QDialogButtonBox::rejected, &dlg, &QDialog::reject);
    QVBoxLayout* lay = new QVBoxLayout(&dlg);
    lay->addLayout(form);
    lay->addWidget(box);

    if (dlg.exec() == QDialog::Accepted) {
        QSqlQuery q;
        q.prepare("SELECT names, surnames, role FROM users WHERE username = ? AND password = ?");
        q.addBindValue(user->text());
        q.addBindValue(pass->text());
        if (q.exec() && q.next()) {
            QString nombres = q.value(0).toString();
            QString apellidos = q.value(1).toString();
            QString rol = q.value(2).toString();
            lblUsuario->setText(QString("%1 %2 (%3)").arg(nombres, apellidos, rol));
            lblUsuario->setStyleSheet("color:#6aff6a;");
            btnGuardar->setEnabled(rol == "admin");
        } else {
            QMessageBox::warning(this, "Login", "Credenciales incorrectas");
        }
    }
}

// =============================================================
//  Guardar ruta del usuario
// =============================================================
void ToursAQP::onGuardarRuta() {
    QVector<int> ids = getNodosSeleccionados();
    if (ids.size() < 2) {
        QMessageBox::warning(this, "Guardar ruta", "Seleccione al menos 2 nodos");
        return;
    }

    QString nombre = QInputDialog::getText(this, "Guardar ruta", "Nombre de la ruta:");
    if (nombre.isEmpty()) return;

    int userId = 1; // fijo por ahora

    QSqlDatabase::database().transaction();
    try {
        QSqlQuery q;
        q.prepare("INSERT INTO user_routes (user_id, name, created_at) "
                  "VALUES (?, ?, datetime('now'))");
        q.addBindValue(userId);
        q.addBindValue(nombre);
        if (!q.exec()) {
            throw std::runtime_error(q.lastError().text().toStdString());
        }
        int routeId = q.lastInsertId().toInt();

        // insertamos segmentos usando las coords reales de nodes
        for (int i = 0; i < ids.size()-1; ++i) {
            int from = ids[i];
            int to   = ids[i+1];

            QSqlQuery qa;
            qa.prepare("SELECT latitude, longitude FROM nodes WHERE id=?");
            qa.addBindValue(from);
            qa.exec(); qa.next();
            double f_lat = qa.value(0).toDouble();
            double f_lon = qa.value(1).toDouble();

            qa.prepare("SELECT latitude, longitude FROM nodes WHERE id=?");
            qa.addBindValue(to);
            qa.exec(); qa.next();
            double t_lat = qa.value(0).toDouble();
            double t_lon = qa.value(1).toDouble();

            // buscar distancia si existe en edges
            double val = 0.0;
            QSqlQuery qe;
            qe.prepare("SELECT value FROM edges WHERE "
                       "(from_node_id = ? AND to_node_id = ?) OR "
                       "(from_node_id = ? AND to_node_id = ?)");
            qe.addBindValue(from);
            qe.addBindValue(to);
            qe.addBindValue(to);
            qe.addBindValue(from);
            if (qe.exec() && qe.next()) {
                val = qe.value(0).toDouble();
            } else {
                // euclidiana simulada
                QPointF pf = coordToScene(f_lat, f_lon);
                QPointF pt = coordToScene(t_lat, t_lon);
                val = QLineF(pf, pt).length() / 100.0;
            }

            QSqlQuery ins;
            ins.prepare("INSERT INTO user_route_edges "
                        "(user_route_id, from_node_id, to_node_id, from_latitude, from_longitude, "
                        " to_latitude, to_longitude, value) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            ins.addBindValue(routeId);
            ins.addBindValue(from);
            ins.addBindValue(to);
            ins.addBindValue(f_lat);
            ins.addBindValue(f_lon);
            ins.addBindValue(t_lat);
            ins.addBindValue(t_lon);
            ins.addBindValue(val);
            if (!ins.exec()) {
                throw std::runtime_error(ins.lastError().text().toStdString());
            }
        }

        QSqlDatabase::database().commit();
        QMessageBox::information(this, "Ruta", "Ruta guardada correctamente.");
        cargarRutasGuardadas();
    } catch (const std::exception& e) {
        QSqlDatabase::database().rollback();
        QMessageBox::critical(this, "Error", e.what());
    }
}

// =============================================================
//  Cargar rutas guardadas
// =============================================================
void ToursAQP::cargarRutasGuardadas() {
    listaRutas->clear();
    int userId = 1;
    QSqlQuery q;
    q.prepare("SELECT id, name FROM user_routes WHERE user_id = ? ORDER BY created_at DESC");
    q.addBindValue(userId);
    if (q.exec()) {
        while (q.next()) {
            int id = q.value(0).toInt();
            QString name = q.value(1).toString();
            QListWidgetItem* it = new QListWidgetItem(name, listaRutas);
            it->setData(Qt::UserRole, id);
        }
    }
}

// =============================================================
//  Mostrar ruta guardada en el mapa
// =============================================================
void ToursAQP::mostrarRutaSeleccionada(QListWidgetItem* item) {
    if (!item) return;
    int routeId = item->data(Qt::UserRole).toInt();

    // primero dibujamos todos los nodos base
    dibujarNodosBase();

    QSqlQuery q;
    q.prepare(R"(
        SELECT from_latitude, from_longitude,
               to_latitude, to_longitude,
               value
        FROM user_route_edges
        WHERE user_route_id = ?
        ORDER BY id
    )");
    q.addBindValue(routeId);

    if (q.exec()) {
        QPen pen(Qt::blue, 3);
        while (q.next()) {
            double f_lat = q.value(0).toDouble();
            double f_lon = q.value(1).toDouble();
            double t_lat = q.value(2).toDouble();
            double t_lon = q.value(3).toDouble();
            double val   = q.value(4).toDouble();

            QPointF p1 = coordToScene(f_lat, f_lon);
            QPointF p2 = coordToScene(t_lat, t_lon);

            // remarcar nodos de la ruta
            auto* n1 = mapaScene->addEllipse(p1.x()-6, p1.y()-6, 12, 12,
                                             QPen(Qt::cyan, 2),
                                             QBrush(Qt::cyan));
            n1->setOpacity(1.0);
            auto* n2 = mapaScene->addEllipse(p2.x()-6, p2.y()-6, 12, 12,
                                             QPen(Qt::cyan, 2),
                                             QBrush(Qt::cyan));
            n2->setOpacity(1.0);

            auto* line = mapaScene->addLine(QLineF(p1, p2), pen);
            line->setData(0, "edge");

            // texto de distancia
            QPointF mid((p1.x()+p2.x())/2, (p1.y()+p2.y())/2);
            QGraphicsTextItem* txt = mapaScene->addText(QString("%1 m").arg(val, 0, 'f', 1));
            txt->setPos(mid);
            txt->setDefaultTextColor(Qt::white);
        }

        mapaView->fitInView(mapaScene->sceneRect(), Qt::KeepAspectRatio);
    }
}

// =============================================================
//  Construir grafo desde edges
// =============================================================
QHash<int, QHash<int, double>> ToursAQP::construirGrafoDesdeEdges() {
    QHash<int, QHash<int, double>> g;
    QSqlQuery q("SELECT from_node_id, to_node_id, value FROM edges");
    while (q.next()) {
        int u = q.value(0).toInt();
        int v = q.value(1).toInt();
        double w = q.value(2).toDouble();
        g[u][v] = w;
        g[v][u] = w;
    }
    return g;
}

// =============================================================
//  Reconstruir camino
// =============================================================
QVector<int> ToursAQP::reconstruirCamino(int start, int goal,
                                         const QHash<int,int>& prev) {
    QVector<int> ruta;
    int cur = goal;
    ruta.prepend(cur);
    while (cur != start) {
        if (!prev.contains(cur)) break;
        cur = prev[cur];
        ruta.prepend(cur);
    }
    return ruta;
}

// =============================================================
//  Visualizar recorrido (DFS/BFS/Dijkstra)
// =============================================================
void ToursAQP::visualizarRecorrido(const QVector<int>& recorrido,
                                   const QString& algoritmo) {
    if (recorrido.isEmpty()) {
        QMessageBox::information(this, algoritmo, "No hay recorrido para mostrar.");
        return;
    }

    // redibujar base
    dibujarNodosBase();

    // dibujar recorrido
    QPen pen(Qt::green, 3);

    // obtener coords de todos
    QHash<int, QPointF> pos;
    {
        QSqlQuery q("SELECT id, latitude, longitude FROM nodes");
        while (q.next()) {
            int id = q.value(0).toInt();
            double lat = q.value(1).toDouble();
            double lon = q.value(2).toDouble();
            pos[id] = coordToScene(lat, lon);
        }
    }

    for (int i = 0; i < recorrido.size(); ++i) {
        int id = recorrido[i];
        if (!pos.contains(id)) continue;
        QPointF p = pos[id];

        QColor c = (i==0 || i==recorrido.size()-1) ? Qt::red : Qt::cyan;
        mapaScene->addEllipse(p.x()-6, p.y()-6, 12, 12,
                              QPen(c,2), QBrush(c));

        QGraphicsTextItem* t = mapaScene->addText(QString::number(i+1));
        t->setDefaultTextColor(c);
        t->setPos(p.x()+8, p.y()-10);

        if (i > 0) {
            int prev = recorrido[i-1];
            if (pos.contains(prev)) {
                mapaScene->addLine(QLineF(pos[prev], p), pen);
            }
        }
    }

    mapaView->fitInView(mapaScene->sceneRect(), Qt::KeepAspectRatio);
    QMessageBox::information(this, algoritmo,
                             QString("Recorrido de %1 nodos").arg(recorrido.size()));
}

// =============================================================
//  DFS
// =============================================================
void ToursAQP::onDFS() {
    QVector<int> ids = getNodosSeleccionados();
    if (ids.isEmpty()) {
        QMessageBox::warning(this, "DFS", "No hay nodos seleccionados");
        return;
    }

    int start = ids.first();
    auto g = construirGrafoDesdeEdges();

    QStack<int> st;
    QSet<int> vis;
    QVector<int> rec;

    st.push(start);
    while (!st.isEmpty()) {
        int u = st.pop();
        if (vis.contains(u)) continue;
        vis.insert(u);
        rec.append(u);
        for (int v : g[u].keys()) {
            if (!vis.contains(v)) st.push(v);
        }
    }

    visualizarRecorrido(rec, "DFS");
}

// =============================================================
//  BFS
// =============================================================
void ToursAQP::onBFS() {
    QVector<int> ids = getNodosSeleccionados();
    if (ids.isEmpty()) {
        QMessageBox::warning(this, "BFS", "No hay nodos seleccionados");
        return;
    }

    int start = ids.first();
    auto g = construirGrafoDesdeEdges();

    QQueue<int> q;
    QSet<int> vis;
    QVector<int> rec;

    q.enqueue(start);
    vis.insert(start);

    while (!q.isEmpty()) {
        int u = q.dequeue();
        rec.append(u);
        for (int v : g[u].keys()) {
            if (!vis.contains(v)) {
                vis.insert(v);
                q.enqueue(v);
            }
        }
    }

    visualizarRecorrido(rec, "BFS");
}

// =============================================================
//  Ruta mínima (Dijkstra)
// =============================================================
void ToursAQP::onRutaMinima() {
    QVector<int> ids = getNodosSeleccionados();
    if (ids.size() < 2) {
        QMessageBox::warning(this, "Ruta mínima", "Seleccione al menos dos nodos");
        return;
    }

    int s = ids.first();
    int t = ids.last();
    auto g = construirGrafoDesdeEdges();

    QHash<int, double> dist;
    QHash<int, int> prev;
    for (auto u : g.keys()) dist[u] = std::numeric_limits<double>::infinity();
    dist[s] = 0.0;

    using P = std::pair<double,int>;
    std::priority_queue<P, std::vector<P>, std::greater<P>> pq;
    pq.push({0.0, s});

    while (!pq.empty()) {
        auto [d,u] = pq.top(); pq.pop();
        if (d > dist[u]) continue;
        for (auto it = g[u].constBegin(); it != g[u].constEnd(); ++it) {
            int v = it.key();
            double w = it.value();
            double nd = dist[u] + w;
            if (nd < dist[v]) {
                dist[v] = nd;
                prev[v] = u;
                pq.push({nd, v});
            }
        }
    }

    if (!prev.contains(t) && t != s) {
        QMessageBox::warning(this, "Ruta mínima", "No hay ruta entre los nodos seleccionados.");
        return;
    }

    QVector<int> ruta = reconstruirCamino(s, t, prev);
    visualizarRecorrido(ruta, "Ruta mínima");
    QMessageBox::information(this, "Ruta mínima",
                             QString("Distancia total: %1 m").arg(dist[t], 0, 'f', 2));
}

#include "toursaqp.h"

#include <QHBoxLayout>
#include <QVBoxLayout>
#include <QPushButton>
#include <QMessageBox>
#include <QSqlQuery>
#include <QInputDialog>
#include <QDialogButtonBox>
#include <QTimer>
#include <QFormLayout>
#include <QGraphicsItem>
#include <QScrollArea>
#include <QResizeEvent>
#include <QPainter>   // para setRenderHint

#include "mapaview.h"
#include "nodepainter.h"
#include "mapgraph.h"
#include "usermanager.h"
#include "savedroutesmanager.h"
#include "utils.h"
#include "nodoswindow.h"

ToursAQP::ToursAQP(QWidget* parent)
    : QWidget(parent),
    comboCategoria(new QComboBox(this)),
    listaRutas(new QListWidget(this)),
    txtBuscar(new QLineEdit(this)),
    btnRutaMinima(new QPushButton("Ruta mínima", this)),
    btnGuardar(new QPushButton("Guardar Ruta", this)),
    btnNodos(new QPushButton("Administrar nodos", this)),
    mapaScene(new QGraphicsScene(this)),
    mapaView(new QGraphicsView(this)),
    lblUsuario(new QLabel("No ha iniciado sesión", this)),
    ubicacionesLayout(new QVBoxLayout()),
    listaResultadosBusqueda(new QListWidget(this))
{
    setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);

    // Nadie puede guardar ni administrar nodos hasta que haya login (y sea admin)
    btnGuardar->setEnabled(false);
    btnNodos->setEnabled(false);

    mapaView->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
    listaRutas->setSizePolicy(QSizePolicy::Preferred, QSizePolicy::Expanding);
    listaResultadosBusqueda->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Minimum);

    // Mejor legibilidad de texto y dibujo
    mapaView->setRenderHint(QPainter::Antialiasing, true);
    mapaView->setRenderHint(QPainter::TextAntialiasing, true);

    setMinimumSize(900, 600);
    QHBoxLayout* mainLayout = new QHBoxLayout(this);

    // PANEL IZQUIERDO
    QVBoxLayout* left = new QVBoxLayout();
    comboCategoria->addItem("Todas las categorias");
    comboCategoria->addItems(
        {"Historico", "Cultural", "Natural", "Comercial", "Educativo", "Restaurantes", "Entretenimiento"});
    QPushButton* btnFiltrar = new QPushButton("Aplicar filtro");
    left->addWidget(new QLabel("Filtrar por categoria"));
    left->addWidget(comboCategoria);
    left->addWidget(btnFiltrar);
    left->addSpacing(10);
    left->addWidget(new QLabel("Rutas guardadas"));
    left->addWidget(listaRutas);
    mainLayout->addLayout(left);

    // PANEL CENTRAL
    QVBoxLayout* center = new QVBoxLayout();
    QLabel* titulo = new QLabel("Tours AQP");
    titulo->setAlignment(Qt::AlignCenter);
    center->addWidget(titulo);

    QHBoxLayout* buscarLay = new QHBoxLayout();
    QPushButton* btnBuscar = new QPushButton("Buscar");
    txtBuscar->setPlaceholderText("Buscar lugar...");
    buscarLay->addWidget(txtBuscar);
    buscarLay->addWidget(btnBuscar);
    center->addLayout(buscarLay);

    center->addWidget(new QLabel("Ubicaciones seleccionadas:"));

    // Zona de ubicaciones seleccionadas con scroll (pequeña)
    QScrollArea* scrollUbicaciones = new QScrollArea(this);
    scrollUbicaciones->setWidgetResizable(true);
    scrollUbicaciones->setVerticalScrollBarPolicy(Qt::ScrollBarAsNeeded);
    scrollUbicaciones->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    scrollUbicaciones->setMinimumHeight(80);
    scrollUbicaciones->setMaximumHeight(120);
    scrollUbicaciones->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Fixed);

    QWidget* contenedorUbicaciones = new QWidget(this);
    contenedorUbicaciones->setLayout(ubicacionesLayout);
    scrollUbicaciones->setWidget(contenedorUbicaciones);

    center->addWidget(scrollUbicaciones);

    // mapa
    mapaScene->setBackgroundBrush(QColor("#2f2f2f"));
    mapaView->setScene(mapaScene);
    mapaView->setMinimumSize(400, 300);
    mapaView->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
    center->addWidget(mapaView, 1);

    QHBoxLayout* btns = new QHBoxLayout();
    QPushButton* btnDFS = new QPushButton("DFS");
    QPushButton* btnBFS = new QPushButton("BFS");
    QPushButton* btnVerOriginal = new QPushButton("Ver recorrido original");
    QPushButton* btnVerTodos = new QPushButton("Ver todos los lugares");
    QPushButton* btnLimpiar = new QPushButton("Nueva ruta (limpiar mapa)");
    btns->addWidget(btnGuardar);
    btns->addWidget(btnRutaMinima);
    btns->addWidget(btnDFS);
    btns->addWidget(btnBFS);
    center->addLayout(btns);
    center->addWidget(btnVerOriginal);
    center->addWidget(btnVerTodos);
    center->addWidget(btnLimpiar);

    mainLayout->addLayout(center);

    // PANEL DERECHO
    QVBoxLayout* right = new QVBoxLayout();
    right->addWidget(lblUsuario);

    QPushButton* btnLogin = new QPushButton("Iniciar sesion");
    right->addWidget(btnLogin);
    right->addWidget(btnNodos);

    right->addWidget(new QLabel("Zoom"));
    QPushButton* zoomIn = new QPushButton("+");
    QPushButton* zoomOut = new QPushButton("-");
    right->addWidget(zoomIn);
    right->addWidget(zoomOut);
    right->addStretch();

    mainLayout->addLayout(right);

    // listaResultadosBusqueda como popup (no en el layout)
    listaResultadosBusqueda->setWindowFlags(Qt::Popup);
    listaResultadosBusqueda->hide();

    // conexiones
    connect(btnBuscar, &QPushButton::clicked, this, &ToursAQP::onBuscar);
    connect(txtBuscar, &QLineEdit::returnPressed, this, &ToursAQP::onBuscar);
    connect(listaResultadosBusqueda, &QListWidget::itemDoubleClicked,
            this, &ToursAQP::agregarUbicacionDesdeBusqueda);
    connect(btnFiltrar, &QPushButton::clicked, this, &ToursAQP::onFiltrar);

    connect(zoomIn, &QPushButton::clicked, this, &ToursAQP::onZoomIn);
    connect(zoomOut, &QPushButton::clicked, this, &ToursAQP::onZoomOut);
    connect(btnLogin, &QPushButton::clicked, this, &ToursAQP::onLogin);

    connect(btnRutaMinima, &QPushButton::clicked, this, &ToursAQP::onRutaMinima);
    connect(btnDFS, &QPushButton::clicked, this, &ToursAQP::onDFS);
    connect(btnBFS, &QPushButton::clicked, this, &ToursAQP::onBFS);
    connect(btnVerOriginal, &QPushButton::clicked, this, &ToursAQP::onVerOriginal);
    connect(btnVerTodos, &QPushButton::clicked, this, &ToursAQP::onVerTodosLosNodos);
    connect(btnGuardar, &QPushButton::clicked, this, &ToursAQP::onGuardarRuta);
    connect(btnNodos, &QPushButton::clicked, this, &ToursAQP::onNodos);
    connect(btnLimpiar, &QPushButton::clicked, this, &ToursAQP::onLimpiarMapa);

    connect(listaRutas, &QListWidget::itemClicked, this, &ToursAQP::mostrarRutaSeleccionada);
}

void ToursAQP::showEvent(QShowEvent* e) {
    QWidget::showEvent(e);
    static bool once = true;

    if (once) {
        once = false;
        cargarRutasGuardadas();
    }
}

void ToursAQP::onBuscar() {
    listaResultadosBusqueda->clear();
    nodosDisponibles.clear();

    QString texto = txtBuscar->text().trimmed();
    if (texto.isEmpty()) {
        listaResultadosBusqueda->hide();
        return;
    }

    QSqlQuery q;
    q.prepare("SELECT id, code, label FROM nodes WHERE label LIKE ? LIMIT 15");
    q.addBindValue("%" + texto + "%");

    if (!q.exec()) {
        listaResultadosBusqueda->hide();
        return;
    }

    int count = 0;
    while (q.next()) {
        QString item = q.value(1).toString() + " - " + q.value(2).toString();
        listaResultadosBusqueda->addItem(item);
        nodosDisponibles[item] = q.value(0).toInt();
        ++count;
    }

    if (count == 0) {
        listaResultadosBusqueda->hide();
        return;
    }

    // popup debajo del cuadro de búsqueda
    QPoint globalPos = txtBuscar->mapToGlobal(QPoint(0, txtBuscar->height()));
    listaResultadosBusqueda->move(globalPos);
    listaResultadosBusqueda->resize(txtBuscar->width(), 180);

    listaResultadosBusqueda->show();
    listaResultadosBusqueda->raise();
}

void ToursAQP::agregarUbicacionDesdeBusqueda(QListWidgetItem* item) {
    listaResultadosBusqueda->hide();

    QString t = item->text();
    int idNodo = nodosDisponibles.value(t, -1);
    if (idNodo == -1) return;
    ordenOriginal.append(idNodo);

    // borrar mensaje inicial del mapa
    for (auto* it : mapaScene->items()) {
        if (auto txt = qgraphicsitem_cast<QGraphicsTextItem*>(it)) {
            if (txt->toPlainText().contains("vacio")) {
                mapaScene->removeItem(txt);
                delete txt;
                break;
            }
        }
    }

    // evitar duplicados en el panel lateral
    for (int i = 0; i < ubicacionesLayout->count(); i++) {
        QWidget* f = ubicacionesLayout->itemAt(i)->widget();
        if (f) {
            QLabel* lblExistente = f->findChild<QLabel*>();
            if (lblExistente && lblExistente->text() == t) {
                QMessageBox::information(this, "Aviso", "Ya esta agregado");
                return;
            }
        }
    }

    // obtener coordenadas de la BD
    QSqlQuery q;
    q.prepare("SELECT ubication FROM nodes WHERE id = ?");
    q.addBindValue(idNodo);

    if (!q.exec() || !q.next()) {
        QMessageBox::warning(this, "Error", "No se pudo obtener la ubicación del nodo.");
        return;
    }

    QString ub = q.value(0).toString();
    QStringList c = ub.split(',');

    if (c.size() < 2) {
        QMessageBox::warning(this, "Error",
                             "Ubicación inválida para el nodo seleccionado:\n\"" + ub + "\"");
        return;
    }

    bool okLat = false;
    bool okLon = false;
    double lat = c[0].toDouble(&okLat);
    double lon = c[1].toDouble(&okLon);

    if (!okLat || !okLon) {
        QMessageBox::warning(this, "Error",
                             "No se pudieron convertir las coordenadas a número:\n\"" + ub + "\"");
        return;
    }

    double x = Utils::lonToX(lon);
    double y = Utils::latToY(lat);

    // dibujar nodo en el mapa
    MapaView::agregarNodo(mapaScene, idNodo, t, QPointF(x, y));

    // agregar fila lateral (lista de seleccionados)
    QWidget* fila = new QWidget();
    QHBoxLayout* lay = new QHBoxLayout(fila);
    lay->setContentsMargins(2, 2, 2, 2);
    lay->setSpacing(6);

    QLabel* lbl = new QLabel(t);
    lbl->setProperty("node_id", idNodo);
    lay->addWidget(lbl);

    QPushButton* del = new QPushButton("X");
    del->setSizePolicy(QSizePolicy::Fixed, QSizePolicy::Fixed);
    del->setFixedSize(22, 22);
    lay->addWidget(del);

    ubicacionesLayout->addWidget(fila);

    connect(del, &QPushButton::clicked, [this, fila, idNodo]() {
        MapaView::eliminarNodo(mapaScene, idNodo);
        fila->deleteLater();

        // al eliminar, volver a ajustar vista
        ajustarVistaMapa();
    });

    MapGraph::generarEdges(mapaScene, getNodosSeleccionados());

    // Ajustar el zoom para que todos los nodos seleccionados se vean
    ajustarVistaMapa();
}

void ToursAQP::onFiltrar() {
    listaResultadosBusqueda->clear();
    nodosDisponibles.clear();

    QString cat = comboCategoria->currentText();
    QSqlQuery q;

    if (cat == "Todas las categorias") {
        q.prepare("SELECT id, code, label FROM nodes");
    } else {
        q.prepare("SELECT id, code, label FROM nodes WHERE type_id = (SELECT id FROM types WHERE name = ?)");
        q.addBindValue(cat);
    }

    if (!q.exec()) return;

    while (q.next()) {
        QString item = q.value(1).toString() + " - " + q.value(2).toString();
        listaResultadosBusqueda->addItem(item);
        nodosDisponibles[item] = q.value(0).toInt();
    }
}

void ToursAQP::onZoomIn() {
    mapaView->scale(1.2, 1.2);
}

void ToursAQP::onZoomOut() {
    mapaView->scale(0.8, 0.8);
}

void ToursAQP::onLogin() {
    QDialog d(this);
    QFormLayout* f = new QFormLayout();
    QLineEdit* u = new QLineEdit();
    QLineEdit* p = new QLineEdit();
    p->setEchoMode(QLineEdit::Password);

    f->addRow("Usuario:", u);
    f->addRow("Contrasena:", p);

    QDialogButtonBox* box = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel);
    QVBoxLayout* v = new QVBoxLayout(&d);
    v->addLayout(f);
    v->addWidget(box);

    connect(box, &QDialogButtonBox::accepted, &d, &QDialog::accept);
    connect(box, &QDialogButtonBox::rejected, &d, &QDialog::reject);

    if (d.exec() != QDialog::Accepted)
        return;

    if (UserManager::login(u->text(), p->text())) {
        lblUsuario->setText(UserManager::getNombreCompleto() + " (" + UserManager::getRol() + ")");
        lblUsuario->setStyleSheet("color:green;");

        // Solo admin puede guardar rutas y administrar nodos
        bool esAdmin = (UserManager::getRol() == "admin");
        btnGuardar->setEnabled(esAdmin);
        btnNodos->setEnabled(esAdmin);
    } else {
        QMessageBox::warning(this, "Error", "Credenciales incorrectas");
    }
}

void ToursAQP::onNodos() {
    NodosWindow* ventana = new NodosWindow(this);
    ventana->exec();
}

void ToursAQP::onVerTodosLosNodos() {
    NodePainter::dibujarTodosLosNodos(mapaScene);
    ajustarVistaMapa();
}

QVector<int> ToursAQP::getNodosSeleccionados() {
    QVector<int> out;

    for (int i = 0; i < ubicacionesLayout->count(); i++) {
        QWidget* fila = ubicacionesLayout->itemAt(i)->widget();
        if (!fila) continue;

        QLabel* lbl = fila->findChild<QLabel*>();
        if (!lbl) continue;

        if (lbl->property("node_id").isValid()) {
            out << lbl->property("node_id").toInt();
        }
    }

    return out;
}

void ToursAQP::onDFS() {
    QVector<int> nodos = getNodosSeleccionados();
    if (nodos.isEmpty()) {
        QMessageBox::warning(this, "DFS", "No hay nodos");
        return;
    }

    QHash<int, QVector<int>> grafo = MapGraph::construirGrafoCompleto(nodos);

    QVector<int> rec;
    QStack<int> pila;
    QSet<int> vis;

    pila.push(nodos.first());

    while (!pila.isEmpty()) {
        int a = pila.pop();
        if (vis.contains(a)) continue;
        vis.insert(a);
        rec << a;

        for (int v : grafo[a]) {
            if (!vis.contains(v)) pila.push(v);
        }
    }

    MapaView::limpiarRecorridos(mapaScene);
    MapaView::mostrarRecorrido(mapaScene, rec, "DFS");

    // ajustar vista para que se vea todo el recorrido
    ajustarVistaMapa();

    QString msg = "DFS:\n";
    for (int i = 0; i < rec.size(); i++)
        msg += QString("%1. %2\n").arg(i + 1).arg(Utils::obtenerNombreNodo(rec[i]));

    QMessageBox::information(this, "DFS", msg);
}

void ToursAQP::onBFS() {
    QVector<int> nodos = getNodosSeleccionados();
    if (nodos.isEmpty()) {
        QMessageBox::warning(this, "BFS", "No hay nodos");
        return;
    }

    QHash<int, QVector<int>> grafo = MapGraph::construirGrafoCompleto(nodos);

    QVector<int> rec;
    QQueue<int> cola;
    QSet<int> vis;

    cola.enqueue(nodos.first());
    vis.insert(nodos.first());

    while (!cola.isEmpty()) {
        int a = cola.dequeue();
        rec << a;

        for (int v : grafo[a]) {
            if (!vis.contains(v)) {
                vis.insert(v);
                cola.enqueue(v);
            }
        }
    }

    MapaView::limpiarRecorridos(mapaScene);
    MapaView::mostrarRecorrido(mapaScene, rec, "BFS");

    // ajustar vista para que se vea todo el recorrido
    ajustarVistaMapa();

    QString msg = "BFS:\n";
    for (int i = 0; i < rec.size(); i++)
        msg += QString("%1. %2\n").arg(i + 1).arg(Utils::obtenerNombreNodo(rec[i]));

    QMessageBox::information(this, "BFS", msg);
}

double ToursAQP::calcularDistanciaEntreNodos(int a, int b) {
    return MapGraph::distanciaEntreNodos(a, b);
}

void ToursAQP::onVerOriginal() {
    if (ordenOriginal.isEmpty()) {
        QMessageBox::information(this, "Info", "Aun no has agregado nodos.");
        return;
    }

    QString msg = "Recorrido original (orden agregado):\n\n";

    for (int i = 0; i < ordenOriginal.size(); i++) {
        msg += QString("%1. %2\n")
        .arg(i + 1)
            .arg(Utils::obtenerNombreNodo(ordenOriginal[i]));
    }

    QMessageBox::information(this, "Recorrido original", msg);
}

void ToursAQP::onRutaMinima() {
    QVector<int> nodos = getNodosSeleccionados();
    if (nodos.size() < 2) {
        QMessageBox::warning(this, "Minima", "Seleccione 2 nodos");
        return;
    }

    QVector<int> ruta;
    QSet<int> vis;

    int actual = nodos.first();
    ruta << actual;
    vis.insert(actual);

    while (vis.size() < nodos.size()) {
        int mejor = -1;
        double mejorDist = 999999999.0;

        for (int v : nodos) {
            if (vis.contains(v)) continue;

            double d = calcularDistanciaEntreNodos(actual, v);
            if (d < mejorDist) {
                mejorDist = d;
                mejor = v;
            }
        }

        if (mejor == -1) break;

        ruta << mejor;
        vis.insert(mejor);
        actual = mejor;
    }

    MapaView::limpiarRecorridos(mapaScene);
    MapaView::mostrarRecorrido(mapaScene, ruta, "MINIMA");

    // ajustar vista para que se vea la ruta mínima completa
    ajustarVistaMapa();

    double total = 0;
    for (int i = 0; i < ruta.size() - 1; i++)
        total += calcularDistanciaEntreNodos(ruta[i], ruta[i + 1]);

    QString msg = QString("Ruta minima:\nDistancia total: %1 m\n\n").arg(total, 0, 'f', 2);

    for (int i = 0; i < ruta.size(); i++)
        msg += QString("%1. %2\n").arg(i + 1).arg(Utils::obtenerNombreNodo(ruta[i]));

    QMessageBox::information(this, "Minima", msg);
}

void ToursAQP::onGuardarRuta() {
    // Seguridad extra: solo si el botón está habilitado (admin logueado)
    if (!btnGuardar->isEnabled()) {
        QMessageBox::warning(this,
                             "Permiso denegado",
                             "Debe iniciar sesión como administrador para guardar rutas.");
        return;
    }

    QVector<int> nodos = getNodosSeleccionados();
    if (nodos.size() < 2) {
        QMessageBox::warning(this, "Error", "Seleccione 2 nodos");
        return;
    }

    QString nombre = QInputDialog::getText(this, "Guardar", "Nombre");
    if (nombre.isEmpty()) return;

    if (SavedRoutesManager::guardarRuta(nombre, nodos)) {
        QMessageBox::information(this, "OK", "Ruta guardada");
        cargarRutasGuardadas();
    } else {
        QMessageBox::critical(this, "Error", "No se pudo guardar");
    }
}

void ToursAQP::onLimpiarMapa() {
    mapaScene->clear();

    QLayoutItem* item;
    while ((item = ubicacionesLayout->takeAt(0)) != nullptr) {
        if (item->widget())
            item->widget()->deleteLater();
        delete item;
    }

    ordenOriginal.clear();
    ultimoRecorrido.clear();
    ultimoTipo.clear();
    nodosDisponibles.clear();

    QGraphicsTextItem* t = mapaScene->addText("Mapa vacio, agregue nodos para comenzar");
    t->setDefaultTextColor(Qt::white);
    t->setPos(100, 150);

    mapaView->fitInView(t->boundingRect(), Qt::KeepAspectRatio);
}

void ToursAQP::cargarRutasGuardadas() {
    listaRutas->clear();
    SavedRoutesManager::cargarRutas(listaRutas);
}

void ToursAQP::mostrarRutaSeleccionada(QListWidgetItem* item) {
    SavedRoutesManager::mostrarRutaEnMapa(mapaScene, mapaView, item);

    // ajustar vista para ver la ruta guardada completa
    ajustarVistaMapa();
}

void ToursAQP::resizeEvent(QResizeEvent* event) {
    QWidget::resizeEvent(event);
    if (!mapaScene || !mapaView) return;
    ajustarVistaMapa();
}

void ToursAQP::ajustarVistaMapa(int margen) {
    QRectF rect = mapaScene->itemsBoundingRect();
    if (rect.isNull()) return;

    rect = rect.adjusted(-margen, -margen, margen, margen);
    mapaView->fitInView(rect, Qt::KeepAspectRatio);
}

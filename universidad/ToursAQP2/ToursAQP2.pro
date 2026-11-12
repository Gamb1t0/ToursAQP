QT += core gui widgets sql
CONFIG += c++17

SOURCES += \
    database.cpp \
    geoutils.cpp \
    main.cpp \
    mapaview.cpp \
    mapgraph.cpp \
    nodepainter.cpp \
    nodoswindow.cpp \
    passwordutils.cpp \
    savedroutesmanager.cpp \
    toursaqp.cpp \
    usermanager.cpp \
    utils.cpp

HEADERS += \
    database.h \
    geoutils.h \
    mapaview.h \
    mapgraph.h \
    nodepainter.h \
    nodoswindow.h \
    passwordutils.h \
    savedroutesmanager.h \
    toursaqp.h \
    usermanager.h \
    utils.h

TRANSLATIONS += \
    ToursAQP2_es_PE.ts
CONFIG += lrelease
CONFIG += embed_translations

# ===== Temas visuales (empaquetados dentro del ejecutable) =====
RESOURCES += \
    resources/styles/styles.qrc

# ===== Base de datos: se copia junto al ejecutable al compilar =====
CONFIG += file_copies

COPIES += dbfiles
dbfiles.files = $$PWD/Tours.s3db
dbfiles.path = $$OUT_PWD

DISTFILES += \
    Tours.s3db

# ===== Instalación por defecto =====
qnx: target.path = /tmp/$${TARGET}/bin
else: unix:!android: target.path = /opt/$${TARGET}/bin
!isEmpty(target.path): INSTALLS += target

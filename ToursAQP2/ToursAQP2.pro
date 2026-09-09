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
    savedroutesmanager.h \
    toursaqp.h \
    usermanager.h \
    utils.h

FORMS += \
    toursaqp.ui

TRANSLATIONS += \
    ToursAQP2_es_PE.ts
CONFIG += lrelease
CONFIG += embed_translations

# ===== Estilos y recursos =====
DISTFILES += \
    resources/styles/dark.qss \
    resources/styles/light.qss \
    resources/styles/modern.qss \
    Tours.s3db

# ===== Instalación por defecto =====
qnx: target.path = /tmp/$${TARGET}/bin
else: unix:!android: target.path = /opt/$${TARGET}/bin
!isEmpty(target.path): INSTALLS += target

#define _USE_MATH_DEFINES
#include "geoutils.h"
#include <cmath>

double GeoUtils::haversine(double lat1, double lon1, double lat2, double lon2) {
    const double R = 6371000.0;

    double dLat = (lat2 - lat1) * M_PI / 180.0;
    double dLon = (lon2 - lon1) * M_PI / 180.0;

    double a =
        sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1 * M_PI / 180.0) *
            cos(lat2 * M_PI / 180.0) *
            sin(dLon / 2) * sin(dLon / 2);

    double c = 2 * atan2(sqrt(a), sqrt(1 - a));

    return R * c;
}

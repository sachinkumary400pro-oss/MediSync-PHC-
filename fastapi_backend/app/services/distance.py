import math
from typing import Protocol, Tuple


class DistanceCalculator(Protocol):
    def calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        ...


class HaversineDistanceCalculator:
    """Computes geodesic distance between two GPS coordinates using the Haversine formula.
    Can be seamlessly substituted with a Road Routing API (e.g. OSRM, Google Maps).
    """
    EARTH_RADIUS_KM = 6371.0

    def calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = (
            math.sin(d_lat / 2.0) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(d_lon / 2.0) ** 2
        )
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return round(self.EARTH_RADIUS_KM * c, 1)


# Global default distance calculator
distance_calculator = HaversineDistanceCalculator()


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    return distance_calculator.calculate_distance(lat1, lon1, lat2, lon2)

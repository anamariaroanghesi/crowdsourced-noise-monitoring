from app.config import settings


class QualityService:
    """Validates noise measurement data before storage."""

    def validate(self, measurement: dict) -> tuple[bool, str]:
        """
        Validate a measurement dict.

        Returns (True, "valid") if the measurement passes all checks,
        or (False, reason) if it fails any check.

        Checks performed:
        - measured_db between 20 and 130 dB
        - gps_accuracy <= 100 metres
        - lat/lon within Bucharest bounding box
        """
        measured_db: float = measurement.get("measured_db", 0.0)
        gps_accuracy: float = measurement.get("gps_accuracy", 0.0)
        latitude: float = measurement.get("latitude", 0.0)
        longitude: float = measurement.get("longitude", 0.0)

        if measured_db < 20 or measured_db > 130:
            return False, "measured_db out of range (20-130 dB)"

        if gps_accuracy > 100:
            return False, "gps_accuracy exceeds 100 metres"

        min_lon, min_lat, max_lon, max_lat = settings.BUCHAREST_BBOX
        if not (min_lon <= longitude <= max_lon and min_lat <= latitude <= max_lat):
            return False, "location outside Bucharest bounding box"

        return True, "valid"


quality_service = QualityService()

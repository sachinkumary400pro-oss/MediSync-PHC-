from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from datetime import datetime


class ExternalStockAdapter(ABC):
    """
    Abstract interface for integrating third-party pharmacy software,
    POS systems, and government inventory gateways (e.g., TNMSC Warehouse Portal,
    Jan Aushadhi ERP, MedPlus / Apollo POS).
    """

    @abstractmethod
    def fetch_inventory(self, external_facility_id: str) -> List[Dict[str, Any]]:
        """Fetch remote inventory for a facility."""
        pass

    @abstractmethod
    def push_stock_update(self, source_id: str, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Push inventory updates from an external ERP into MediSync."""
        pass


class TNMSCWarehouseAdapter(ExternalStockAdapter):
    """Stub adapter for Tamil Nadu Medical Services Corporation central warehouse API."""

    def fetch_inventory(self, external_facility_id: str) -> List[Dict[str, Any]]:
        # Stub implementation simulating TNMSC e-Aushadhi API response
        return [
            {
                "medicine_code": "TN-MED-PARA-100",
                "batch_number": "TN26-0941",
                "quantity": 10000,
                "expiry_date": "2027-12-31",
                "last_sync": datetime.utcnow().isoformat(),
            }
        ]

    def push_stock_update(self, source_id: str, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "status": "success",
            "source_id": source_id,
            "system": "TNMSC Warehouse Ingestion",
            "items_processed": len(items),
            "timestamp": datetime.utcnow().isoformat(),
        }


class PrivatePharmacyPOSAdapter(ExternalStockAdapter):
    """Stub adapter for private retail pharmacy software (Marg ERP, Apollo, MedPlus)."""

    def fetch_inventory(self, external_facility_id: str) -> List[Dict[str, Any]]:
        return []

    def push_stock_update(self, source_id: str, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "status": "success",
            "source_id": source_id,
            "system": "Retail POS Ingestion",
            "items_processed": len(items),
            "timestamp": datetime.utcnow().isoformat(),
        }

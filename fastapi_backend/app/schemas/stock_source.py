from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class StockSourceBase(BaseModel):
    name: str
    source_type: str
    address: str
    block: str
    district: str = "Chengalpattu"
    latitude: float
    longitude: float
    phone: str
    opening_hours: str = "08:00 - 20:00"
    is_24x7: bool = False
    ownership: str = "government"
    is_verified: bool = True
    is_active: bool = True
    visibility: str = "public"
    parent_source_id: Optional[str] = None


class StockSourceCreate(StockSourceBase):
    id: Optional[str] = None


class StockSourceUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    opening_hours: Optional[str] = None
    is_24x7: Optional[bool] = None
    is_verified: Optional[bool] = None
    is_active: Optional[bool] = None
    visibility: Optional[str] = None


class StockSourceOut(StockSourceBase):
    id: str
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class SourceStockItemUpdate(BaseModel):
    medicine_id: str
    quantity: int
    price_per_unit: Optional[float] = 0.0
    batch_no: Optional[str] = None
    expiry_date: Optional[str] = None
    client_entry_id: Optional[str] = None


class SourceStockBulkUpdate(BaseModel):
    client_entry_id: Optional[str] = None
    items: List[SourceStockItemUpdate]


class SourceStockOut(BaseModel):
    id: str
    source_id: str
    medicine_id: str
    medicine_name: Optional[str] = None
    generic_name: Optional[str] = None
    category: Optional[str] = None
    form: Optional[str] = None
    strength: Optional[str] = None
    quantity: Optional[int] = None
    quantity_status: str  # "available", "low_stock", "out_of_stock"
    price_per_unit: Optional[float] = 0.0
    is_free: bool = True
    batch_no: Optional[str] = None
    expiry_date: Optional[str] = None
    is_near_expiry: bool = False
    is_cold_chain: bool = False
    is_critical: bool = False
    last_updated: Optional[datetime] = None
    is_stale: bool = False
    stale_severity: str = "fresh"
    model_config = ConfigDict(from_attributes=True)


class FinderSearchResult(BaseModel):
    source_id: str
    name: str
    source_type: str
    ownership: str
    distance_km: float
    quantity: Optional[int] = None
    quantity_status: str
    price_per_unit: Optional[float] = 0.0
    is_free: bool = True
    last_updated: Optional[datetime] = None
    is_stale: bool = False
    stale_severity: str = "fresh"
    is_open: bool = True
    opening_hours: str
    phone: str
    latitude: float
    longitude: float
    score: float
    score_reasons: List[str]
    medicine_id: Optional[str] = None
    medicine_name: Optional[str] = None
    medicine_form: Optional[str] = None
    is_cold_chain: bool = False
    is_critical: bool = False


class FinderSearchResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: List[FinderSearchResult]


class MultiCoverageSource(BaseModel):
    source_id: str
    name: str
    source_type: str
    ownership: str
    distance_km: float
    covers_count: int
    total_requested: int
    coverage_ratio: float
    in_stock_medicines: List[str]
    missing_medicines: List[str]
    estimated_total_cost: float
    phone: str
    latitude: float
    longitude: float


class FinderMultiResponse(BaseModel):
    requested_medicines: List[Dict[str, str]]
    total_sources_evaluated: int
    sources_with_coverage: List[MultiCoverageSource]
    best_combination: Dict[str, Any]


class MapMarkerOut(BaseModel):
    id: str
    name: str
    source_type: str
    ownership: str
    latitude: float
    longitude: float
    phone: str
    opening_hours: str
    is_24x7: bool
    is_open: bool
    distance_km: Optional[float] = None
    availability_status: Optional[str] = None
    quantity: Optional[int] = None
    price_per_unit: Optional[float] = None
    is_free: Optional[bool] = None
    is_stale: bool = False


class SourceStockListResponse(BaseModel):
    source: StockSourceOut
    items: List[SourceStockOut]
    total_items: int
    page: int
    page_size: int

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List
from datetime import date, datetime


class StockEntryCreate(BaseModel):
    client_entry_id: Optional[str] = None  # Idempotency token
    phc_id: str
    medicine_id: str
    date: date
    opening: int = Field(ge=0, description="Opening stock must be >= 0")
    received: int = Field(default=0, ge=0, description="Received stock must be >= 0")
    issued: int = Field(default=0, ge=0, description="Issued stock must be >= 0")
    closing: int = Field(ge=0, description="Closing stock must be >= 0")
    batch_no: Optional[str] = None
    expiry_date: Optional[date] = None
    entered_by: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator("closing")
    def validate_math_consistency(cls, v, info):
        opening = info.data.get("opening", 0)
        received = info.data.get("received", 0)
        issued = info.data.get("issued", 0)
        if issued > (opening + received):
            raise ValueError(f"Issued quantity ({issued}) cannot exceed available stock ({opening + received})")
        expected_closing = opening + received - issued
        if v != expected_closing:
            raise ValueError(f"Closing stock ({v}) does not match opening + received - issued ({expected_closing})")
        return v


class StockEntryOut(BaseModel):
    id: str
    client_entry_id: Optional[str] = None
    phc_id: str
    medicine_id: str
    date: date
    opening: int
    received: int
    issued: int
    closing: int
    batch_no: Optional[str] = None
    expiry_date: Optional[date] = None
    entered_by: Optional[str] = None
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CurrentStockOut(BaseModel):
    id: str
    phc_id: str
    phc_name: Optional[str] = None
    medicine_id: str
    medicine_name: Optional[str] = None
    code: Optional[str] = None
    category: Optional[str] = None
    form: Optional[str] = None
    strength: Optional[str] = None
    unit: Optional[str] = None
    is_critical: Optional[bool] = False
    is_cold_chain: Optional[bool] = False
    quantity: int
    avg_daily_use_7d: float
    avg_daily_use_30d: float
    effective_daily_rate: float
    days_left: int
    status: str
    trend: str = "stable"
    runout_date: Optional[str] = None
    spareable_surplus: int = 0
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DaysLeftResponse(BaseModel):
    phc_id: str
    critical_count: int
    low_count: int
    adequate_count: int
    items: List[CurrentStockOut]


class BatchOut(BaseModel):
    id: str
    phc_id: str
    medicine_id: str
    batch_number: str
    expiry_date: date
    quantity: int
    supplier_source: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

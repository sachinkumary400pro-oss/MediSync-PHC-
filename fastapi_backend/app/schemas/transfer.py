from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


class TransferItemCreate(BaseModel):
    medicine_id: str
    batch_no: Optional[str] = None
    requested_qty: int


class TransferItemOut(BaseModel):
    id: str
    medicine_id: str
    medicine_name: Optional[str] = None
    unit: Optional[str] = None
    batch_no: Optional[str] = None
    requested_qty: int
    approved_qty: Optional[int] = None
    received_qty: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class TransferCreate(BaseModel):
    from_phc_id: str
    to_phc_id: str
    urgency: str = "normal"  # normal, critical, emergency
    reason: Optional[str] = None
    cold_chain_confirmed: bool = False
    items: List[TransferItemCreate]


class TransferOut(BaseModel):
    id: str
    request_number: str
    from_phc_id: str
    from_phc_name: Optional[str] = None
    to_phc_id: str
    to_phc_name: Optional[str] = None
    status: str
    urgency: str
    reason: Optional[str] = None
    cold_chain_confirmed: bool
    distance_km: Optional[float] = None
    created_by: str
    approved_by: Optional[str] = None
    received_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    items: List[TransferItemOut] = []

    model_config = ConfigDict(from_attributes=True)


class TransferStatusUpdate(BaseModel):
    status: str  # approved, in_transit, received, completed, rejected, cancelled

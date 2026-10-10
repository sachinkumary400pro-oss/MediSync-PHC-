from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


class EmergencyIndentItemCreate(BaseModel):
    medicine_id: str
    requested_qty: int
    justification: Optional[str] = None


class EmergencyIndentItemOut(BaseModel):
    id: str
    medicine_id: str
    medicine_name: Optional[str] = None
    unit: Optional[str] = None
    requested_qty: int
    approved_qty: Optional[int] = None
    justification: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class EmergencyIndentCreate(BaseModel):
    phc_id: str
    reason: str
    items: List[EmergencyIndentItemCreate]


class EmergencyIndentOut(BaseModel):
    id: str
    indent_number: str
    phc_id: str
    phc_name: Optional[str] = None
    status: str
    reason: str
    auto_drafted: bool
    created_by: str
    approved_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    items: List[EmergencyIndentItemOut] = []

    model_config = ConfigDict(from_attributes=True)


class IndentStatusUpdate(BaseModel):
    status: str  # submitted, approved, dispatched, received, rejected

from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class AlertOut(BaseModel):
    id: str
    phc_id: str
    phc_name: Optional[str] = None
    medicine_id: str
    medicine_name: Optional[str] = None
    type: str  # stockout, low_stock, near_expiry, anomaly_spike, monsoon_surge
    severity: str  # low, medium, high, critical
    message: str
    status: str  # new, acknowledged, resolved
    acknowledged_by: Optional[str] = None
    resolved_by: Optional[str] = None
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AlertStatusUpdate(BaseModel):
    status: str  # acknowledged, resolved

from pydantic import BaseModel, ConfigDict
from typing import Optional


class MedicineBase(BaseModel):
    code: str
    name: str
    generic_name: str
    form: str
    strength: str
    category: str
    unit: str = "units"
    is_cold_chain: bool = False
    is_critical: bool = False
    default_threshold_days: int = 15
    emergency_buffer_days: int = 30
    seasonal_sensitivity: str = "normal"


class MedicineCreate(MedicineBase):
    pass


class MedicineUpdate(BaseModel):
    name: Optional[str] = None
    generic_name: Optional[str] = None
    default_threshold_days: Optional[int] = None
    emergency_buffer_days: Optional[int] = None
    is_cold_chain: Optional[bool] = None
    is_critical: Optional[bool] = None


class MedicineOut(MedicineBase):
    id: str

    model_config = ConfigDict(from_attributes=True)

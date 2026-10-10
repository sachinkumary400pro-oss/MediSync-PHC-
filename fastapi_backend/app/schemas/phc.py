from pydantic import BaseModel, ConfigDict
from typing import Optional


class PHCBase(BaseModel):
    name: str
    block: str
    district: str = "Chengalpattu"
    latitude: float
    longitude: float
    population_served: int = 30000
    phone: str
    medical_officer_name: Optional[str] = None
    pharmacist_name: Optional[str] = None
    address: Optional[str] = None


class PHCCreate(PHCBase):
    id: str


class PHCOut(PHCBase):
    id: str

    model_config = ConfigDict(from_attributes=True)

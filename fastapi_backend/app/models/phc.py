from sqlalchemy import Column, String, Float, Integer
from sqlalchemy.orm import relationship
from app.database import Base


class PHC(Base):
    __tablename__ = "phcs"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    block = Column(String, nullable=False, index=True)
    district = Column(String, nullable=False, default="Chengalpattu")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    population_served = Column(Integer, nullable=False, default=30000)
    phone = Column(String, nullable=False)
    medical_officer_name = Column(String, nullable=True)
    pharmacist_name = Column(String, nullable=True)
    address = Column(String, nullable=True)

    users = relationship("User", back_populates="phc")
    stock_entries = relationship("StockEntry", back_populates="phc")
    current_stocks = relationship("CurrentStock", back_populates="phc")
    alerts = relationship("Alert", back_populates="phc")
    batches = relationship("Batch", back_populates="phc")

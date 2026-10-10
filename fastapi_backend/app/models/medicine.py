from sqlalchemy import Column, String, Integer, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(String, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False, index=True)
    generic_name = Column(String, nullable=False)
    form = Column(String, nullable=False)  # Tablet, Syrup, Vial, Capsule, etc.
    strength = Column(String, nullable=False)
    category = Column(String, nullable=False, index=True)
    unit = Column(String, nullable=False, default="units")  # bottles, tablets, vials, sachets
    is_cold_chain = Column(Boolean, nullable=False, default=False)
    is_critical = Column(Boolean, nullable=False, default=False)
    default_threshold_days = Column(Integer, nullable=False, default=15)
    emergency_buffer_days = Column(Integer, nullable=False, default=30)
    seasonal_sensitivity = Column(String, default="normal")

    stock_entries = relationship("StockEntry", back_populates="medicine")
    current_stocks = relationship("CurrentStock", back_populates="medicine")
    alerts = relationship("Alert", back_populates="medicine")
    batches = relationship("Batch", back_populates="medicine")

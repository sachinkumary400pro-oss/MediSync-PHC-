from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Pharmacy(Base):
    __tablename__ = "pharmacies"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    owner_name = Column(String, nullable=False)
    license_number = Column(String, unique=True, nullable=False, index=True)
    address = Column(String, nullable=False)
    block = Column(String, nullable=False, index=True)
    district = Column(String, nullable=False, default="Chengalpattu")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    phone = Column(String, nullable=False)
    opening_hours = Column(String, nullable=False, default="08:00 - 22:00")
    is_24x7 = Column(Boolean, nullable=False, default=False)
    is_verified = Column(Boolean, nullable=False, default=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    stock = relationship("PharmacyStock", back_populates="pharmacy", cascade="all, delete-orphan")
    users = relationship("User", back_populates="pharmacy")


class PharmacyStock(Base):
    __tablename__ = "pharmacy_stock"

    id = Column(String, primary_key=True, index=True)
    pharmacy_id = Column(String, ForeignKey("pharmacies.id", ondelete="CASCADE"), nullable=False, index=True)
    medicine_id = Column(String, ForeignKey("medicines.id"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False, default=0)
    price_per_unit = Column(Float, nullable=True)  # Retail price in INR (₹)
    batch_no = Column(String, nullable=True)
    expiry_date = Column(String, nullable=True)  # YYYY-MM-DD
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by = Column(String, nullable=True)

    # Relationships
    pharmacy = relationship("Pharmacy", back_populates="stock")
    medicine = relationship("Medicine")

from datetime import datetime, timezone
import enum
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Enum as SQLEnum,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class SourceType(str, enum.Enum):
    PHC = "phc"
    SUB_CENTRE = "sub_centre"
    CHC_HOSPITAL = "chc_hospital"
    WAREHOUSE = "warehouse"
    JAN_AUSHADHI_COOP = "jan_aushadhi_coop"
    PRIVATE_PHARMACY = "private_pharmacy"
    PRIVATE_HOSPITAL = "private_hospital"
    NGO_DISPENSARY = "ngo_dispensary"


class OwnershipType(str, enum.Enum):
    GOVERNMENT = "government"
    COOPERATIVE = "cooperative"
    PRIVATE = "private"
    NGO = "ngo"


class VisibilityType(str, enum.Enum):
    PUBLIC = "public"
    STAFF_ONLY = "staff_only"


class StockSource(Base):
    __tablename__ = "stock_sources"

    id = Column(String, primary_key=True, index=True)
    source_type = Column(String, nullable=False, index=True)  # SourceType enum value
    name = Column(String, nullable=False, index=True)
    address = Column(String, nullable=False)
    block = Column(String, nullable=False, index=True)
    district = Column(String, nullable=False, default="Chengalpattu")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    phone = Column(String, nullable=False)
    opening_hours = Column(String, nullable=False, default="08:00 - 20:00")
    is_24x7 = Column(Boolean, nullable=False, default=False)
    ownership = Column(String, nullable=False, default="government", index=True)
    is_verified = Column(Boolean, nullable=False, default=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    visibility = Column(String, nullable=False, default="public", index=True)  # public or staff_only
    parent_source_id = Column(String, ForeignKey("stock_sources.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    stock = relationship("SourceStock", back_populates="source", cascade="all, delete-orphan")
    users = relationship("SourceUser", back_populates="source", cascade="all, delete-orphan")
    parent_source = relationship("StockSource", remote_side=[id], backref="child_sources")


class SourceStock(Base):
    __tablename__ = "source_stock"

    id = Column(String, primary_key=True, index=True)
    source_id = Column(String, ForeignKey("stock_sources.id", ondelete="CASCADE"), nullable=False, index=True)
    medicine_id = Column(String, ForeignKey("medicines.id"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False, default=0)
    price_per_unit = Column(Float, nullable=True, default=0.0)  # 0 or null for free
    batch_no = Column(String, nullable=True)
    expiry_date = Column(String, nullable=True)  # YYYY-MM-DD
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True)
    updated_by = Column(String, nullable=True)
    data_origin = Column(String, nullable=False, default="manual")  # manual, csv, api, system

    # Relationships
    source = relationship("StockSource", back_populates="stock")
    medicine = relationship("Medicine")


class SourceUser(Base):
    __tablename__ = "source_users"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id = Column(String, ForeignKey("stock_sources.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="managed_sources")
    source = relationship("StockSource", back_populates="users")

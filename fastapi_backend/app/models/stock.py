from sqlalchemy import Column, String, Integer, Float, Date, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Batch(Base):
    __tablename__ = "batches"

    id = Column(String, primary_key=True, index=True)
    phc_id = Column(String, ForeignKey("phcs.id"), nullable=False, index=True)
    medicine_id = Column(String, ForeignKey("medicines.id"), nullable=False, index=True)
    batch_number = Column(String, nullable=False, index=True)
    expiry_date = Column(Date, nullable=False, index=True)
    quantity = Column(Integer, nullable=False, default=0)
    supplier_source = Column(String, default="TNMSC Central Warehouse")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    phc = relationship("PHC", back_populates="batches")
    medicine = relationship("Medicine", back_populates="batches")


class StockEntry(Base):
    __tablename__ = "stock_entries"

    id = Column(String, primary_key=True, index=True)
    client_entry_id = Column(String, unique=True, index=True, nullable=True)  # Idempotency token for offline sync
    phc_id = Column(String, ForeignKey("phcs.id"), nullable=False, index=True)
    medicine_id = Column(String, ForeignKey("medicines.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    opening = Column(Integer, nullable=False)
    received = Column(Integer, nullable=False, default=0)
    issued = Column(Integer, nullable=False, default=0)
    closing = Column(Integer, nullable=False)
    batch_no = Column(String, nullable=True)
    expiry_date = Column(Date, nullable=True)
    entered_by = Column(String, nullable=True)
    remarks = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    phc = relationship("PHC", back_populates="stock_entries")
    medicine = relationship("Medicine", back_populates="stock_entries")

    __table_args__ = (
        Index("ix_stock_entry_phc_med_date", "phc_id", "medicine_id", "date"),
    )


class CurrentStock(Base):
    __tablename__ = "current_stock"

    id = Column(String, primary_key=True, index=True)
    phc_id = Column(String, ForeignKey("phcs.id"), nullable=False, index=True)
    medicine_id = Column(String, ForeignKey("medicines.id"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False, default=0)
    avg_daily_use_7d = Column(Float, nullable=False, default=0.0)
    avg_daily_use_30d = Column(Float, nullable=False, default=0.0)
    days_left = Column(Integer, nullable=False, default=999)
    status = Column(String, nullable=False, default="Adequate")  # Green (>30d), Amber (15-30d), Red (<15d), Out of Stock (0d), Surplus (>60d)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    phc = relationship("PHC", back_populates="current_stocks")
    medicine = relationship("Medicine", back_populates="current_stocks")

    __table_args__ = (
        Index("ix_current_stock_phc_med", "phc_id", "medicine_id", unique=True),
    )

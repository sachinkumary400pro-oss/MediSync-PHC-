from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class TransferRequest(Base):
    __tablename__ = "transfer_requests"

    id = Column(String, primary_key=True, index=True)
    request_number = Column(String, unique=True, index=True, nullable=False)
    from_phc_id = Column(String, ForeignKey("phcs.id"), nullable=False, index=True)
    to_phc_id = Column(String, ForeignKey("phcs.id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="requested", index=True)  # requested, approved, in_transit, received, completed, rejected, cancelled
    urgency = Column(String, nullable=False, default="normal")  # normal, critical, emergency
    reason = Column(String, nullable=True)
    cold_chain_confirmed = Column(Boolean, nullable=False, default=False)
    distance_km = Column(Float, nullable=True)
    created_by = Column(String, nullable=False)
    approved_by = Column(String, nullable=True)
    received_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    from_phc = relationship("PHC", foreign_keys=[from_phc_id])
    to_phc = relationship("PHC", foreign_keys=[to_phc_id])
    items = relationship("TransferItem", back_populates="transfer", cascade="all, delete-orphan")


class TransferItem(Base):
    __tablename__ = "transfer_items"

    id = Column(String, primary_key=True, index=True)
    transfer_id = Column(String, ForeignKey("transfer_requests.id"), nullable=False, index=True)
    medicine_id = Column(String, ForeignKey("medicines.id"), nullable=False, index=True)
    batch_no = Column(String, nullable=True)
    requested_qty = Column(Integer, nullable=False)
    approved_qty = Column(Integer, nullable=True)
    received_qty = Column(Integer, nullable=True)

    transfer = relationship("TransferRequest", back_populates="items")
    medicine = relationship("Medicine")

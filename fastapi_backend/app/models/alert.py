from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True, index=True)
    phc_id = Column(String, ForeignKey("phcs.id"), nullable=False, index=True)
    medicine_id = Column(String, ForeignKey("medicines.id"), nullable=False, index=True)
    type = Column(String, nullable=False, index=True)  # stockout, low_stock, near_expiry, anomaly_spike, monsoon_surge
    severity = Column(String, nullable=False, default="medium")  # low, medium, high, critical
    message = Column(String, nullable=False)
    status = Column(String, nullable=False, default="new", index=True)  # new, acknowledged, resolved
    acknowledged_by = Column(String, nullable=True)
    resolved_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    phc = relationship("PHC", back_populates="alerts")
    medicine = relationship("Medicine", back_populates="alerts")

    __table_args__ = (
        Index("ix_alerts_phc_status", "phc_id", "status"),
    )

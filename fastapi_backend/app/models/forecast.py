from sqlalchemy import Column, String, Integer, Float, Date, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Forecast(Base):
    __tablename__ = "forecasts"

    id = Column(String, primary_key=True, index=True)
    phc_id = Column(String, ForeignKey("phcs.id"), nullable=False, index=True)
    medicine_id = Column(String, ForeignKey("medicines.id"), nullable=False, index=True)
    predicted_runout_date = Column(Date, nullable=True)
    confidence = Column(Float, nullable=False, default=0.90)
    effective_daily_rate = Column(Float, nullable=False, default=0.0)
    days_left = Column(Integer, nullable=False, default=999)
    suggested_buffer_qty = Column(Integer, nullable=False, default=0)
    reasoning = Column(String, nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())

    phc = relationship("PHC")
    medicine = relationship("Medicine")

    __table_args__ = (
        Index("ix_forecasts_phc_med", "phc_id", "medicine_id"),
    )

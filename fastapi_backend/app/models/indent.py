from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class EmergencyIndent(Base):
    __tablename__ = "emergency_indents"

    id = Column(String, primary_key=True, index=True)
    indent_number = Column(String, unique=True, index=True, nullable=False)
    phc_id = Column(String, ForeignKey("phcs.id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="draft", index=True)  # draft, submitted, approved, dispatched, received, rejected
    reason = Column(String, nullable=False)
    auto_drafted = Column(Boolean, nullable=False, default=False)
    created_by = Column(String, nullable=False)
    approved_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    phc = relationship("PHC")
    items = relationship("EmergencyIndentItem", back_populates="indent", cascade="all, delete-orphan")


class EmergencyIndentItem(Base):
    __tablename__ = "emergency_indent_items"

    id = Column(String, primary_key=True, index=True)
    indent_id = Column(String, ForeignKey("emergency_indents.id"), nullable=False, index=True)
    medicine_id = Column(String, ForeignKey("medicines.id"), nullable=False, index=True)
    requested_qty = Column(Integer, nullable=False)
    approved_qty = Column(Integer, nullable=True)
    justification = Column(String, nullable=True)

    indent = relationship("EmergencyIndent", back_populates="items")
    medicine = relationship("Medicine")

from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    action = Column(String, nullable=False, index=True)  # LOGIN, STOCK_ENTRY, CREATE_TRANSFER, APPROVE_TRANSFER, UPDATE_STOCK
    entity = Column(String, nullable=False, index=True)  # stock_entries, transfer_requests, emergency_indents, medicines
    entity_id = Column(String, nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.pharmacy import Pharmacy


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # pharmacist, medical_officer, block_officer, district_admin, pharmacy_owner
    phc_id = Column(String, ForeignKey("phcs.id"), nullable=True)
    pharmacy_id = Column(String, ForeignKey("pharmacies.id"), nullable=True)
    block = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    phc = relationship("PHC", back_populates="users")
    pharmacy = relationship("Pharmacy", back_populates="users")
    managed_sources = relationship("SourceUser", back_populates="user", cascade="all, delete-orphan")

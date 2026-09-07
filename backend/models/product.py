from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, Text, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String, unique=True, index=True)
    name = Column(String, nullable=False)
    brand = Column(String, nullable=True)
    category = Column(String, nullable=True)
    mfg_date = Column(DateTime, nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    batch_number = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    source = Column(String, default="manual")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    scan_logs = relationship("ScanLog", back_populates="product")
    alerts = relationship("Alert", back_populates="product")


class ScanLog(Base):
    __tablename__ = "scan_logs"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    barcode = Column(String, nullable=True)
    scan_type = Column(String, nullable=False)
    result_status = Column(String, nullable=False)
    expiry_date_scanned = Column(DateTime, nullable=True)
    confidence = Column(Float, nullable=True)
    raw_ocr_text = Column(Text, nullable=True)
    scanned_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="scan_logs")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    alert_type = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    days_until_expiry = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="alerts")

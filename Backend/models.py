from sqlalchemy import Column, Integer, String, Float, Text, BigInteger, DateTime, Date
from sqlalchemy.dialects.postgresql import JSONB
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)

    role = Column(String, default="user", nullable=False)

class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)

    description = Column(String, nullable=True)

    latitude = Column(Float, nullable=False)

    longitude = Column(Float, nullable=False)

    image_filename = Column(String, nullable=False)

class MasterFile(Base):
    __tablename__ = "masterfile"

    file_id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(Text)
    layer_name = Column(String(255))
    geometry_type = Column(String(50))
    data_format = Column(String(50))
    file_size = Column(BigInteger)
    spatial_reference = Column(String(255))
    extent = Column(JSONB)
    creation_date = Column(DateTime)
    data_source = Column(Text)
    processing = Column(Text)
    accuracy = Column(String(100))
    version = Column(String(50))
    responsible_person = Column(String(255))
    description = Column(Text)
    remarks = Column(Text)
    keywords = Column(Text)
    data_privacy = Column(String(100))
    data_sharing_agreement_with = Column(Text)


class RawData(Base):
    __tablename__ = "raw_data"

    raw_data_id = Column(Integer, primary_key=True, index=True)
    main_folder = Column(String(255), nullable=True)
    folder_name = Column(String(255), nullable=True)
    full_path = Column(Text, nullable=True)
    pscg = Column(String(20), nullable=True)
    model_unit = Column(String(255), nullable=True)
    gsd = Column(String(50), nullable=True)
    uav_mission_id = Column(String(100), nullable=True)
    file_size = Column(String(50), nullable=True)
    creation_date = Column(Date, nullable=True)
    data_source = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    data_privacy = Column(String(100), nullable=True)

import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from PIL import Image
from PIL.ExifTags import GPSTAGS

from database import get_db
from auth import get_current_user

router = APIRouter(
    prefix="/raw-data",
    tags=["GPS Extraction"]
)


def convert_to_degrees(value):
    degrees = float(value[0])
    minutes = float(value[1])
    seconds = float(value[2])

    return degrees + minutes / 60 + seconds / 3600


def extract_gps(image_path):
    try:
        with Image.open(image_path) as image:
            exif = image.getexif()

            if not exif:
                return None

            gps_ifd = exif.get_ifd(0x8825)

            gps = {
                GPSTAGS.get(key, key): value
                for key, value in gps_ifd.items()
            }

            required = (
                "GPSLatitude",
                "GPSLatitudeRef",
                "GPSLongitude",
                "GPSLongitudeRef",
            )

            if not all(key in gps for key in required):
                return None

            latitude = convert_to_degrees(gps["GPSLatitude"])
            longitude = convert_to_degrees(gps["GPSLongitude"])

            if gps["GPSLatitudeRef"] == "S":
                latitude = -latitude

            if gps["GPSLongitudeRef"] == "W":
                longitude = -longitude

            return {
                "latitude": latitude,
                "longitude": longitude,
            }

    except Exception:
        return None


@router.get("/{record_id}/locations")
def get_raw_data_locations(
    record_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = db.execute(
        text("""
            SELECT raw_data_id, full_path
            FROM public.raw_data
            WHERE raw_data_id = :record_id
        """),
        {"record_id": record_id},
    ).first()

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Raw Data record not found.",
        )

    full_path = result._mapping["full_path"]

    if not full_path:
        raise HTTPException(
            status_code=404,
            detail="No file path is available.",
        )

    folder_path = Path(
        os.path.expandvars(str(full_path).strip())
    )

    if not folder_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Path does not exist: {folder_path}",
        )

    if folder_path.is_file():
        image_files = (
            [folder_path]
            if folder_path.suffix.lower() in (".jpg", ".jpeg")
            else []
        )

    elif folder_path.is_dir():
        image_files = sorted(
            [
                item for item in folder_path.iterdir()
                if item.is_file()
                and item.suffix.lower() in (".jpg", ".jpeg")
            ],
            key=lambda item: item.name.lower(),
        )

    else:
        image_files = []

    locations = []

    for image_path in image_files:
        gps = extract_gps(image_path)

        if gps:
            locations.append({
                "filename": image_path.name,
                **gps,
            })

    return {
        "record_id": record_id,
        "count": len(locations),
        "locations": locations,
    }

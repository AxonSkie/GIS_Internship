import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from database import get_db
from models import Location

router = APIRouter(
    prefix="/locations",
    tags=["Locations"]
)

UPLOAD_FOLDER = "uploads"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@router.post("/")
async def create_location(
    name: str = Form(...),
    description: str = Form(""),
    latitude: float = Form(...),
    longitude: float = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    if image.content_type not in ["image/jpeg", "image/jpg"]:
        raise HTTPException(
            status_code=400,
            detail="Only JPG images are allowed"
        )

    file_extension = ".jpg"
    filename = f"{uuid.uuid4()}{file_extension}"

    file_path = os.path.join(
        UPLOAD_FOLDER,
        filename
    )

    with open(file_path, "wb") as file:
        file.write(await image.read())

    new_location = Location(
        name=name,
        description=description,
        latitude=latitude,
        longitude=longitude,
        image_filename=filename
    )

    db.add(new_location)
    db.commit()
    db.refresh(new_location)

    return {
        "message": "Location created successfully",
        "location": new_location
    }

@router.get("/")
def get_locations(db: Session = Depends(get_db)):
    locations = db.query(Location).all()

    return locations
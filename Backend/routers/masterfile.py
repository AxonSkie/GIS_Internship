import os

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from models import MasterFile


def convert_file_size(value):
    if pd.isna(value):
        return None

    value = str(value).strip().lower()

    try:
        if value.endswith("gb"):
            return int(float(value[:-2]) * 1024 * 1024 * 1024)

        if value.endswith("mb"):
            return int(float(value[:-2]) * 1024 * 1024)

        if value.endswith("kb"):
            return int(float(value[:-2]) * 1024)

        if value.endswith("b"):
            return int(float(value[:-1]))

        return int(float(value))

    except ValueError:
        raise ValueError(f"Invalid file size: {value}")


router = APIRouter(
    prefix="/masterfile",
    tags=["Master File"]
)


@router.post("/upload")
async def upload_masterfile(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Check file extension
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=400,
            detail="Only .xlsx files are allowed"
        )

    try:
        # Read uploaded Excel file
        contents = await file.read()

        # Save temporarily
        temp_file = f"temp_{file.filename}"

        with open(temp_file, "wb") as f:
            f.write(contents)

        # Read Excel file
        df = pd.read_excel(temp_file)

        # Remove temporary file
        os.remove(temp_file)

        # Insert each Excel row into PostgreSQL
        for _, row in df.iterrows():

            new_file = MasterFile(
                file_name=str(row.get("File Name", "")),
                file_path=str(row.get("File Path", "")),
                layer_name=str(row.get("Layer Name", "")),
                geometry_type=str(row.get("Geometry Type", "")),
                data_format=str(row.get("Data Format", "")),
                file_size=convert_file_size(
                    row.get("File Size")
                ),
                spatial_reference=str(
                    row.get("Spacial Reference", "")
                ),
                extent=None,
                creation_date=pd.to_datetime(
                    row.get("Creation date")
                )
                if pd.notna(row.get("Creation date"))
                else None,
                data_source=str(
                    row.get("Data source", "")
                ),
                processing=str(
                    row.get("Processing", "")
                ),
                accuracy=str(
                    row.get("Accuracy", "")
                ),
                version=str(
                    row.get("Version", "")
                ),
                responsible_person=str(
                    row.get("Responsible Person", "")
                ),
                description=str(
                    row.get("Description", "")
                ),
                remarks=str(
                    row.get("Remarks", "")
                ),
                keywords=str(
                    row.get("Keywords", "")
                ),
                data_privacy=str(
                    row.get("Data Privacy", "")
                ),
                data_sharing_agreement_with=str(
                    row.get("Data Sharing Agreement with", "")
                )
            )

            db.add(new_file)

        db.commit()

        return {
            "message": "Excel file uploaded successfully",
            "rows_imported": len(df)
        }

    except Exception as e:
        db.rollback()

        # Remove temporary file if it still exists
        if os.path.exists(temp_file):
            os.remove(temp_file)

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.get("/")
def get_masterfiles(db: Session = Depends(get_db)):
    return db.query(MasterFile).all()
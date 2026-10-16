import os

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Body
from sqlalchemy.orm import Session
from auth import get_current_admin
from auth import get_current_editor_or_admin


from database import get_db
from models import MasterFile

EXPECTED_COLUMNS = [
    "File Name",
    "File Path",
    "Layer Name",
    "Geometry Type",
    "Data Format",
    "File Size",
    "Spacial Reference",
    "Creation date",
    "Data source",
    "Processing",
    "Accuracy",
    "Version",
    "Responsible Person",
    "Description",
    "Remarks",
    "Keywords",
    "Data Privacy",
    "Data Sharing Agreement with",
]


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
    db: Session = Depends(get_db),
    current_admin: dict = Depends(get_current_admin),
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

        missing_columns = [
            column for column in EXPECTED_COLUMNS if column not in df.columns
        ]
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Missing Excel columns: {', '.join(missing_columns)}",
            )

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

    except HTTPException:
        db.rollback()
        if os.path.exists(temp_file):
            os.remove(temp_file)
        raise
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




@router.put("/{record_id}")
def update_record(
    record_id: int,
    data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin),
):
    allowed_fields = {
        "file_name",
        "file_path",
        "layer_name",
        "geometry_type",
        "data_format",
        "file_size",
        "spatial_reference",
        "extent",
        "creation_date",
        "data_source",
        "processing",
        "accuracy",
        "version",
        "responsible_person",
        "description",
        "remarks",
        "keywords",
        "data_privacy",
        "data_sharing_agreement_with",
    }

    if not data:
        raise HTTPException(
            status_code=400,
            detail="No fields provided to update.",
        )

    invalid_fields = set(data.keys()) - allowed_fields
    if invalid_fields:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid fields: {', '.join(sorted(invalid_fields))}",
        )

    try:
        record = db.query(MasterFile).filter(
            MasterFile.file_id == record_id
        ).first()

        if record is None:
            raise HTTPException(
                status_code=404,
                detail="Master File record not found.",
            )

        for field, value in data.items():
            if field == "file_size" and value is not None:
                try:
                    value = int(value)
                except (TypeError, ValueError):
                    raise HTTPException(
                        status_code=400,
                        detail="file_size must be an integer in bytes.",
                    )

                if value < 0:
                    raise HTTPException(
                        status_code=400,
                        detail="file_size cannot be negative.",
                    )

            if field == "creation_date" and value is not None:
                try:
                    value = pd.to_datetime(
                        value, errors="raise"
                    ).to_pydatetime()
                except (ValueError, TypeError):
                    raise HTTPException(
                        status_code=400,
                        detail="creation_date must be a valid date.",
                    )

            setattr(record, field, value)

        db.commit()
        db.refresh(record)

        return {
            "message": "Master File record updated successfully.",
            "record": {
                "file_id": record.file_id,
                "file_name": record.file_name,
                "description": record.description,
            },
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()
        print("Master File update error:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update Master File record: {str(exc)}",
        )


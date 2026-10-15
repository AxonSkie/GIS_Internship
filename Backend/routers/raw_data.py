
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from io import BytesIO
import pandas as pd

from database import get_db
from models import RawData
from auth import get_current_admin
from auth import get_current_editor_or_admin

router = APIRouter(
    prefix="/raw-data",
    tags=["Raw Data"]
)


@router.get("/")
def get_raw_data(db: Session = Depends(get_db)):
    records = db.query(RawData).all()

    return [
        {
            column.name: getattr(record, column.name)
            for column in RawData.__table__.columns
        }
        for record in records
    ]


@router.post("/import")
async def import_raw_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_admin: dict = Depends(get_current_admin),

):
    # Check the file extension
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=400,
            detail="Please upload an Excel .xlsx file."
        )

    try:
        contents = await file.read()

        # Read the first worksheet
        df = pd.read_excel(BytesIO(contents), engine="openpyxl")

        # Match Excel headers to database column names
        column_mapping = {
            "Main Folder": "main_folder",
            "Folder Name": "folder_name",
            "Full path": "full_path",
            "PSCG": "pscg",
            "Model Unit": "model_unit",
            "GSD": "gsd",
            "UAV Mission ID": "uav_mission_id",
            "File Size": "file_size",
            "Creation date": "creation_date",
            "Data source": "data_source",
            "Description": "description",
            "Data Privacy": "data_privacy",
        }

        # Check required spreadsheet headers
        missing_columns = [
            column for column in column_mapping
            if column not in df.columns
        ]

        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Missing Excel columns: {', '.join(missing_columns)}"
            )

        # Keep only the columns that belong to raw_data
        df = df[list(column_mapping.keys())]
        df = df.rename(columns=column_mapping)

        # Convert empty cells to None and prepare records
        df = df.astype(object).where(pd.notna(df), None)

        records = []

        for row in df.to_dict(orient="records"):
            # Convert pandas date/timestamp values to Python dates
            value = row.get("creation_date")
            if value is not None and hasattr(value, "date"):
                row["creation_date"] = value.date()

            # Ignore completely empty rows
            if all(value is None or str(value).strip() == "" for value in row.values()):
                continue

            records.append(RawData(**row))

        if not records:
            raise HTTPException(
                status_code=400,
                detail="No data rows were found in the Excel file."
            )

        # Insert all rows in one transaction
        db.add_all(records)
        db.commit()

        return {
            "message": "Excel data imported successfully.",
            "imported_rows": len(records)
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Excel import failed: {str(error)}"
        )



@router.put("/{record_id}")
def update_raw_data(
    record_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_editor_or_admin),
):
    allowed_fields = {
        "main_folder",
        "folder_name",
        "full_path",
        "pscg",
        "model_unit",
        "gsd",
        "uav_mission_id",
        "file_size",
        "creation_date",
        "data_source",
        "description",
        "data_privacy",
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
        record = db.query(RawData).filter(
            RawData.raw_data_id == record_id
        ).first()

        if record is None:
            raise HTTPException(
                status_code=404,
                detail="Raw Data record not found.",
            )

        for field, value in data.items():
            if field == "creation_date" and value is not None:
                try:
                    value = pd.to_datetime(
                        value,
                        errors="raise",
                    ).date()
                except (ValueError, TypeError):
                    raise HTTPException(
                        status_code=400,
                        detail="creation_date must be a valid date.",
                    )

            setattr(record, field, value)

        db.commit()
        db.refresh(record)

        return {
            "message": "Raw Data record updated successfully.",
            "raw_data_id": record.raw_data_id,
            "updated_fields": list(data.keys()),
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()
        print("Raw Data update error:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to update Raw Data record.",
        )


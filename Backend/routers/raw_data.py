
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from io import BytesIO
import pandas as pd

from database import get_db
from models import RawData

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
    db: Session = Depends(get_db)
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
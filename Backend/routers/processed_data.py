
import re
import pandas as pd

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db

router = APIRouter(
    prefix="/processed-data",
    tags=["Processed Data"],
)

EXPECTED_COLUMNS = [
    "Main Folder",
    "Folder Name",
    "Full path",
    "PSCG",
    "File Size",
    "UAV Mission ID",
    "Creation date",
    "Data source",
    "Description",
    "Data Privacy",
]


def clean_value(value):
    """Convert empty Excel cells to None and NumPy values to Python values."""
    if pd.isna(value):
        return None

    if hasattr(value, "item"):
        value = value.item()

    return value


def parse_file_size(value):
    """Convert file sizes such as '568 MB' or '3.16 GB' to bytes."""
    value = clean_value(value)

    if value is None:
        return None

    if isinstance(value, (int, float)):
        return int(value)

    match = re.fullmatch(
        r"\s*(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?\s*",
        str(value),
        re.IGNORECASE,
    )

    if not match:
        raise ValueError(f"Invalid File Size value: {value}")

    number = float(match.group(1))
    unit = (match.group(2) or "B").upper()
    multipliers = {
        "B": 1,
        "KB": 1024,
        "MB": 1024**2,
        "GB": 1024**3,
        "TB": 1024**4,
    }

    return int(number * multipliers[unit])


@router.post("/upload")
def upload_processed_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=400,
            detail="Please upload an .xlsx Excel file.",
        )

    try:
        df = pd.read_excel(file.file, engine="openpyxl")
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Unable to read the Excel file. Check that it is a valid .xlsx file.",
        )
    finally:
        file.file.close()

    # Remove accidental spaces around Excel column headings.
    df.columns = [str(column).strip() for column in df.columns]

    missing_columns = [
        column for column in EXPECTED_COLUMNS
        if column not in df.columns
    ]

    if missing_columns:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "The Excel file is missing required columns.",
                "missing_columns": missing_columns,
            },
        )

    insert_sql = text("""
        INSERT INTO processed_data (
            "Main Folder",
            "Folder Name",
            "Full path",
            "PSCG",
            "File Size",
            "UAV Mission ID",
            "Creation date",
            "Data source",
            "Description",
            "Data Privacy"
        )
        VALUES (
            :main_folder,
            :folder_name,
            :full_path,
            :pscg,
            :file_size,
            :uav_mission_id,
            :creation_date,
            :data_source,
            :description,
            :data_privacy
        )
    """)

    inserted_count = 0

    try:
        for _, row in df[EXPECTED_COLUMNS].iterrows():
            raw_date = clean_value(row["Creation date"])

            if raw_date is not None:
                parsed_date = pd.to_datetime(raw_date, errors="coerce")

                if pd.isna(parsed_date):
                    raise ValueError(
                        f"Invalid Creation date value: {raw_date}"
                    )

                creation_date = parsed_date.to_pydatetime()
            else:
                creation_date = None

            params = {
                "main_folder": clean_value(row["Main Folder"]),
                "folder_name": clean_value(row["Folder Name"]),
                "full_path": clean_value(row["Full path"]),
                "pscg": clean_value(row["PSCG"]),
                "file_size": parse_file_size(row["File Size"]),
                "uav_mission_id": clean_value(row["UAV Mission ID"]),
                "creation_date": creation_date,
                "data_source": clean_value(row["Data source"]),
                "description": clean_value(row["Description"]),
                "data_privacy": clean_value(row["Data Privacy"]),
            }

            db.execute(insert_sql, params)
            inserted_count += 1

        db.commit()

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Import failed. No rows were saved: {exc}",
        )

    return {
        "message": "Excel data imported successfully.",
        "filename": file.filename,
        "rows_imported": inserted_count,
    }


@router.get("/")
def get_processed_data(db: Session = Depends(get_db)):
    result = db.execute(text("""
        SELECT
            id,
            "Main Folder",
            "Folder Name",
            "Full path",
            "PSCG",
            "File Size",
            "UAV Mission ID",
            "Creation date",
            "Data source",
            "Description",
            "Data Privacy",
            uploaded_at
        FROM processed_data
        ORDER BY id DESC
    """))

    return [dict(row._mapping) for row in result]

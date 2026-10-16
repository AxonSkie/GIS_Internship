
import re
import pandas as pd
import os


from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import Query
from pathlib import Path
from fastapi.responses import FileResponse




from database import get_db
from auth import get_current_admin, get_current_editor_or_admin, get_current_user



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
    current_admin: dict = Depends(get_current_admin),

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



@router.put("/{record_id}")
def update_record(
    record_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_admin),
):
    allowed_columns = {
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
    }

    if not data:
        raise HTTPException(
            status_code=400,
            detail="No fields provided to update.",
        )

    invalid_columns = set(data.keys()) - allowed_columns

    if invalid_columns:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid fields: {', '.join(invalid_columns)}",
        )

    try:
        existing = db.execute(
            text("SELECT id FROM processed_data WHERE id = :id"),
            {"id": record_id},
        ).first()

        if existing is None:
            raise HTTPException(
                status_code=404,
                detail="Processed Data record not found.",
            )

        updates = []
        params = {"record_id": record_id}

        for index, (column, value) in enumerate(data.items()):
            parameter = f"value_{index}"
            updates.append(f'"{column}" = :{parameter}')
            params[parameter] = value

        query = text(
            f"""
            UPDATE processed_data
            SET {", ".join(updates)}
            WHERE id = :record_id
            """
        )

        db.execute(query, params)
        db.commit()

        return {
            "message": "Processed Data record updated successfully.",
            "record_id": record_id,
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update record: {exc}",
        )



@router.get("/{record_id}/preview")
def preview_processed_data_image(
    record_id: int,
    filename: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = db.execute(
        text("""
            SELECT id, "Full path"
            FROM processed_data
            WHERE id = :record_id
        """),
        {"record_id": record_id},
    ).first()

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Processed Data record not found.",
        )

    full_path = result._mapping["Full path"]

    if not full_path:
        raise HTTPException(
            status_code=404,
            detail="No file path is available.",
        )

    folder_path = Path(
        os.path.expandvars(str(full_path).strip())
    )

    allowed_images = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
    }

    if not folder_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Path does not exist: {folder_path}",
        )

    # If Full path points directly to an image
    if folder_path.is_file():
        if folder_path.suffix.lower() not in allowed_images:
            raise HTTPException(
                status_code=415,
                detail="This file format cannot be previewed.",
            )

        return FileResponse(
            path=str(folder_path),
            media_type=allowed_images[folder_path.suffix.lower()],
        )

    if not folder_path.is_dir():
        raise HTTPException(
            status_code=404,
            detail="The stored path is not a file or folder.",
        )

    # Find images directly inside the folder
    images = sorted(
        [
            item for item in folder_path.iterdir()
            if item.is_file()
            and item.suffix.lower() in allowed_images
        ],
        key=lambda item: item.name.lower(),
    )

    if not images:
        raise HTTPException(
            status_code=404,
            detail={
                "message": "No JPG, JPEG, or PNG images found.",
                "folder_path": str(folder_path),
            },
        )

    # Return a selected image
    if filename is not None:
        matching_image = next(
            (item for item in images if item.name == filename),
            None,
        )

        if matching_image is None:
            raise HTTPException(
                status_code=404,
                detail="Image not found in this folder.",
            )

        return FileResponse(
            path=str(matching_image),
            media_type=allowed_images[
                matching_image.suffix.lower()
            ],
        )

    # Otherwise return the list of images
    return {
        "message": "Images found in this folder.",
        "folder_path": str(folder_path),
        "count": len(images),
        "images": [
            {
                "filename": item.name,
                "preview_url": (
                    f"/processed-data/{record_id}/preview"
                    f"?filename={item.name}"
                ),
            }
            for item in images
        ],
    }




@router.post("/{record_id}/open-folder")
def open_processed_data_folder(
    record_id: int,
    db: Session = Depends(get_db),
            current_user: dict = Depends(get_current_user),

):
    result = db.execute(
        text("""
            SELECT id, "Full path"
            FROM processed_data
            WHERE id = :record_id
        """),
        {"record_id": record_id},
    ).first()

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Processed Data record not found.",
        )

    full_path = result._mapping["Full path"]

    if not full_path:
        raise HTTPException(
            status_code=404,
            detail="No file path is available for this record.",
        )

    path = Path(os.path.expandvars(str(full_path).strip()))

    if path.is_dir():
        folder = path
    elif path.is_file():
        folder = path.parent
    else:
        raise HTTPException(
            status_code=404,
            detail="The stored file or directory does not exist.",
        )

    if os.name != "nt":
        raise HTTPException(
            status_code=501,
            detail="Opening File Explorer is supported only when the backend runs on Windows.",
        )

    try:
        os.startfile(str(folder))
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to open the directory: {exc}",
        )

    return {
        "message": "Directory opened successfully.",
        "record_id": record_id,
    }



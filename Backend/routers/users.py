from fastapi import APIRouter, Depends

from auth import get_current_user, get_current_admin


router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


@router.get("/me")
def get_me(
    current_user: dict = Depends(get_current_user)
):
    return {
        "message": "You are authenticated!",
        "user_id": current_user["user_id"],
        "role": current_user["role"]
    }


@router.get("/admin-test")
def admin_test(
    current_admin: dict = Depends(get_current_admin)
):
    return {
        "message": "Welcome Admin!",
        "user_id": current_admin["user_id"],
        "role": current_admin["role"]
    }
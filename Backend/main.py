from fastapi import FastAPI

from database import engine
from models import Base
from routers.auth import router as auth_router
from routers.users import router as users_router
from fastapi.middleware.cors import CORSMiddleware
from routers.admin import router as admin_router
from routers.locations import router as locations_router
from fastapi.staticfiles import StaticFiles
from routers import auth, users, admin, locations, masterfile
from routers import raw_data
from routers.processed_data import router as processed_data_router




app = FastAPI()
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

Base.metadata.create_all(bind=engine)


app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(locations_router)
app.include_router(masterfile.router)
app.include_router(raw_data.router)
app.include_router(processed_data_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Backend is running!"}

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import connect_to_mongo, close_mongo_connection, get_database
from app.core.config import settings
from app.routers import chat, documents, sessions, audio, voice, auth

logging.basicConfig(
  level=logging.INFO,
  format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
  logger.info("Starting application...")
  await connect_to_mongo()
  yield
  
  logger.info("Shutting down application...")
  await close_mongo_connection()
  
origins = [
  "http://localhost:3000",
]
  
app = FastAPI(
  title=settings.PROJECT_NAME,
  debug=settings.DEBUG,
  lifespan=lifespan
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=origins, 
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

@app.get("/health", tags=["Health Check"])
async def health_check():
  return {
    "status": "online",
    "environment": settings.ENVIRONMENT,
    "app_name": settings.PROJECT_NAME
  }
  
app.include_router(chat.router)
app.include_router(documents.router)
app.include_router(sessions.router)
app.include_router(audio.router)
app.include_router(voice.router)
app.include_router(auth.router)
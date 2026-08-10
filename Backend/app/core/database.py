import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

logger = logging.getLogger(__name__)

class Database:
  client: AsyncIOMotorClient | None = None
  db: AsyncIOMotorDatabase | None = None
  
db_instance = Database()

async def connect_to_mongo():
  logger.info("Connecting to MongoDB Atlas...")
  
  db_instance.client = AsyncIOMotorClient(
    settings.MONGO_URI,
    maxPoolSize=10,
    minPoolSize=1,
    serverSelectionTimeoutMS=5000
  )
  db_instance.db = db_instance.client[settings.MONGO_DB_NAME]
  
  try:
    await db_instance.client.admin.command("Ping")
    logger.info("Successfully connected to MongoDB Atlas!")
  except Exception as e:
    logger.error(f"Failed to connect to MongoDB Atlas: {e}")
    raise e
  
async def close_mongo_connection():
  if db_instance.client:
    logger.info("Closing MongoDB connection pool...")
    db_instance.client.close()
    logger.info("MongoDB connection closed.")
    
def get_database() -> AsyncIOMotorDatabase:
  if db_instance.db is None:
    raise RuntimeError("Database connection has not been initialized.")
  return db_instance.db
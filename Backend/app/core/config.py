from functools import lru_cache
from typing import Optional
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
  PROJECT_NAME: str = "OpenChat API"
  ENVIRONMENT: str = "development"
  DEBUG: bool = True
  
  MONGO_URI: str
  MONGO_DB_NAME: str = "chatgpt_rag"
  
  MONGO_VECTOR_INDEX_NAME: str = "vector_index"
  
  GOOGLE_API_KEY: SecretStr
  GROQ_API_KEY: Optional[SecretStr] = None
  
  JWT_SECRET_KEY: SecretStr
  JWT_ALGORITHM: str = "HS256"
  ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
  
  model_config = SettingsConfigDict(
    env_file=".env",
    env_file_encoding="utf-8",
    extra="ignore"
  )
  
@lru_cache
def get_settings() -> Settings:
  """
  Creates and caches an instance of Settings.
  lru_cache ensures .env is read only once instead of on every request.
  """
  return Settings()

settings = get_settings()
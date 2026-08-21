from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
from app.core.database import get_database

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security_scheme = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
  return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
  return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
  to_encode = data.copy()
  expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
  to_encode.update({"exp": expire})
  return jwt.encode(to_encode, settings.JWT_SECRET_KEY.get_secret_value(), algorithm=settings.JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> dict:
  credentials_exception = HTTPException(
    status_code=401,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
  )
  
  token = credentials.credentials
  try:
    payload = jwt.decode(token, settings.JWT_SECRET_KEY.get_secret_value(), algorithms=[settings.JWT_ALGORITHM])
    user_id: str = payload.get("sub")
    if user_id is None:
      raise credentials_exception
    
  except JWTError:
        raise credentials_exception
      
  db = get_database()
  user = await db.users.find_one({"user_id": user_id})
  if user is None:
    raise credentials_exception
  return user
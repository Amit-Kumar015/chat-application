import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import get_database
from app.core.security import get_password_hash, verify_password, create_access_token, get_current_user
from app.schemas.auth_schema import UserSignupRequest, UserLoginRequest, TokenResponse, UserResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/signup", response_model=TokenResponse, status_code=201)
async def signup(payload: UserSignupRequest):
  db = get_database()
  now = datetime.now(timezone.utc)
  email_clean = payload.email.lower().strip()
  
  existing_user = await db.users.find_one({"email": email_clean})
  if existing_user:
    raise HTTPException(status_code=400, detail="An account with this email already exists.")
  
  user_id = f"usr_{uuid.uuid4().hex[:12]}"
  user_doc = {
    "user_id": user_id,
    "name": payload.name.strip(),
    "email": email_clean,
    "password_hash": get_password_hash(payload.password),
    "created_at": now,
    "updated_at": now
  }
  await db.users.insert_one(user_doc)
  
  token = create_access_token(data={"sub": user_id, "email": email_clean})
  
  return TokenResponse(
    access_token=token,
    user=UserResponse(
      user_id=user_id,
      name=user_doc["name"],
      email=user_doc["email"],
      created_at=now
    )
  )
  
@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLoginRequest):
  db = get_database()
  email_clean = payload.email.lower().strip()
  
  user = await db.users.find_one({"email": email_clean})
  if not user or not verify_password(payload.password, user["password_hash"]):
    raise HTTPException(status_code=401, detail="Incorrect email or password.")

  token = create_access_token(data={"sub": user["user_id"], "email": email_clean})

  return TokenResponse(
    access_token=token,
    user=UserResponse(
      user_id=user["user_id"],
      name=user["name"],
      email=user["email"],
      created_at=user["created_at"]
    )
  )
  
@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
  return UserResponse(
    user_id=current_user["user_id"],
    name=current_user["name"],
    email=current_user["email"],
    created_at=current_user["created_at"]
  )
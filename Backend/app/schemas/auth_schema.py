from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserSignupRequest(BaseModel):
  name: str = Field(..., min_length=2)
  email: EmailStr
  password: str = Field(..., min_length=6)
    
class UserLoginRequest(BaseModel):
  email: EmailStr
  password: str
  
class UserResponse(BaseModel):
  user_id: str
  name: str
  email: str
  created_at: datetime
  
class TokenResponse(BaseModel):
  access_token: str
  token_type: str = "bearer"
  user: UserResponse  

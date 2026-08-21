from pydantic import BaseModel, Field, HttpUrl
from datetime import datetime
from typing import List, Optional

class ChatSessionCreate(BaseModel):
  title: Optional[str] = Field(default="New Chat", max_length=100)
  
class ChatSessionRename(BaseModel):
  title: str = Field(..., min_length=1, max_length=100)
  
class ChatSessionResponse(BaseModel):
  user_id: str
  session_id: str
  title: str
  created_at: datetime
  updated_at: datetime
  
class MessageItem(BaseModel):
  role: str
  content: str
  timestamp: datetime
  
class ChatHistoryResponse(BaseModel):
  session_id: str
  messages: List[MessageItem]

class ChatRequest(BaseModel):
  session_id: str = Field(
    ...,
    min_length=1,
    description="Unique identifier for the user session",
    examples=["session_12345"]
  )
  message: str = Field(
    ...,
    min_length=1,
    description="User question or prompt",
    examples=["What is discussed in the uploaded document?"]
  )
  
class ChatResponse(BaseModel):
  session_id: str
  response: str
  
class URLIngestRequest(BaseModel):
  session_id: str = Field(
    ...,
    min_length=1
  )
  url: HttpUrl = Field(
    ...,
    description="Valid web URL to ingest"
  )
  
class IngestResponse(BaseModel):
  session_id: str
  status: str
  chunk_count: int
  source: str
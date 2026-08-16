import logging
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException
from app.core.database import get_database
from app.services.vector_service import delete_session_vectors
from app.schemas.chat_schema import (
    ChatSessionRename,
    ChatSessionResponse,
    ChatHistoryResponse,
    MessageItem,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["Chat Sessions"])

@router.get("", response_model=List[ChatSessionResponse])
async def list_sessions():
  db = get_database()
  cursor = db.sessions.find().sort("updated_at", -1)
  sessions = []
  
  async for doc in cursor:
    sessions.append(
      ChatSessionResponse(
        session_id=doc["session_id"],
        title=doc["title"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
      )
    )
    
  return sessions

@router.post("", response_model=ChatSessionResponse, status_code=201)
async def create_session():
  db = get_database()
  session_id = str(uuid.uuid4())
  now = datetime.now(timezone.utc)
  
  session_doc = {
    "session_id": session_id,
    "title": "New Chat",
    "created_at": now,
    "updated_at": now
  }
  
  await db.sessions.insert(session_doc)
  return ChatSessionResponse(**session_doc)

@router.get("/{session_id}/messages", response_model=ChatHistoryResponse)
async def get_session_history(session_id: str):
  db = get_database()
  
  session = await db.sessions.find_one({"session_id": session_id})
  if not session:
    raise HTTPException(status_code=404, detail="Session not found")
  
  messages = []
  cursor = db.chat_history.find({"session_id": session_id}).sort("timestamp")
  async for doc in cursor:
    messages.append(
      MessageItem(
        role=doc["role"],
        content=doc["content"],
        timestamp=doc["timestamp"],
      )
    )
    
  return ChatHistoryResponse(session_id=session_id, messages=messages)

@router.patch("/{session_id}", response_model=ChatSessionResponse)
async def rename_session(session_id: str, payload: ChatSessionRename):
  db = get_database()
  now = datetime.now(timezone.utc)
  
  result = await db.sessions.find_one_and_update(
    {"session_id": session_id},
    {"$set": {"title": payload.title.strip(), "updated_at": now}},
    return_document = True
  )
  
  if not result:
    raise HTTPException(status_code=404, detail="Session not found")

  return ChatSessionResponse(
    session_id=result["session_id"],
    title=result["title"],
    created_at=result["created_at"],
    updated_at=result["updated_at"],
  )
  
@router.delete("/{session_id}", status_code=204)
async def delete_session(session_id: str):
  db = get_database()
  
  res = await db.sessions.delete_one({"session_id": session_id})
  if res.deleted_count == 0:
    raise HTTPException(status_code=404, detail="Session not found")

  await db.chat_history.delete_many({"session_id": session_id})

  await db.documents.delete_many({"session_id": session_id})

  await delete_session_vectors(session_id)

  return None
  
  
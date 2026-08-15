import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.schemas.chat_schema import ChatRequest, ChatResponse
from app.services.llm_service import generate_rag_response, generate_chat_title
from app.core.database import get_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post('', response_model=ChatResponse, status_code=200)
async def chat_endpoint(payload: ChatRequest):
  db = get_database()
  now = datetime.now(timezone.utc)
  
  try:
    existing_session = await db.sessions.find_one({"session_id": payload.session_id})
    
    if not existing_session:
      title = await generate_chat_title(payload.message)
      await db.sessions.insert_one({
        "session_id": payload.session_id,
        "title": title,
        "created_at": now,
        "updated_at": now,
      })
    else:
      await db.sessions.update_one(
        {"session_id": payload.session_id},
        {"$set": {"updated_at": now}}
      )
      
    await db.chat_histories.insert_one({
      "session_id": payload.session_id,
      "role": "user",
      "content": payload.message,
      "timestamp": now,
    })
    
    answer = await generate_rag_response(question=payload.message, session_id=payload.session_id)
    
    await db.chat_histories.insert_one({
      "session_id": payload.session_id,
      "role": "assistant",
      "content": answer,
      "timestamp": datetime.now(timezone.utc),
    })
    
    return ChatResponse(
      session_id=payload.session_id,
      response=answer
    )
  
  except Exception as e:
    logger.error(f"Error processing chat request for session {payload.session_id}: {e}")
    raise HTTPException(
      status_code=500,
      detail="An error occurred while generating the response."
    )
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.schemas.chat_schema import ChatRequest, ChatResponse
from app.services.llm_service import generate_rag_response
from app.core.database import get_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post('', response_model=ChatResponse, status_code=201)
async def chat_endpoint(payload: ChatRequest):
  try:
    answer = await generate_rag_response(question=payload.message, session_id=payload.session_id)
    
    db = get_database()
    await db.chat_histories.insert_one({
      "session_id": payload.session_id,
      "user_message": payload.message,
      "bot_response": answer,
      "timestamp": datetime.now(timezone.utc)
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
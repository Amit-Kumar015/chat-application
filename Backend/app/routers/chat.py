import logging
import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.schemas.chat_schema import ChatRequest, ChatResponse
from app.services.llm_service import generate_chat_title, stream_rag_response
from app.core.database import get_database
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post('', status_code=200)
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
        
    async def response_stream():
      collected_token = []
      
      try:
        async for token in stream_rag_response(payload.message, payload.session_id):
          collected_token.append(token)
          yield f"data: {json.dumps({'token': token})}\n\n"
          
        fully_bot_response = "".join(collected_token)
        await db.chat_history.insert_many([
          {
            "session_id": payload.session_id,
            "role": "user",
            "content": payload.message,
            "timestamp": now,
          },
          {
            "session_id": payload.session_id,
            "role": "assistant",
            "content": fully_bot_response,
            "timestamp": datetime.now(timezone.utc),
          }
        ])
        
        yield "data: [DONE]\n\n"
      except Exception as stream_err:
        logger.error(f"Error during stream output: {stream_err}")
        yield f"data: {json.dumps({'error': 'An error occurred during generation.'})}\n\n"
        
    return StreamingResponse(
      response_stream(),
      media_type="text/event-stream",
      headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    )
  
  except Exception as e:
    logger.error(f"Error processing chat request for session {payload.session_id}: {e}")
    raise HTTPException(
      status_code=500,
      detail="An error occurred while generating the response."
    )
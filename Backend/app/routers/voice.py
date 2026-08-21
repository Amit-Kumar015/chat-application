import base64
import os
import tempfile
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from groq import AsyncGroq
import edge_tts

from app.core.config import settings
from app.core.database import get_database
from app.services.llm_service import generate_chat_title
from app.services.vector_service import get_retriever
from app.services.llm_service import rag_prompt, general_prompt, llm, get_recent_chat_history
from langchain_core.output_parsers import StrOutputParser
from app.core.security import get_current_user

logger = logging.getLogger(__name__)

groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY.get_secret_value())
router = APIRouter(prefix="/voice", tags=["Voice"])

VOICE_MODEL = "en-US-JennyNeural"

class VoiceResponse(BaseModel):
  user_text: str
  assistant_text: str
  audio_base64: str
  
@router.post("/chat", response_model=VoiceResponse, status_code=200)
async def voice_chat_turn(session_id: str = Form(...), file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
  db = get_database()
  now = datetime.now(timezone.utc)
  user_id = current_user["user_id"]
  
  try:
    content = await file.read()
    transcription = await groq_client.audio.transcriptions.create(
      file=(file.filename or "voice.webm", content),
      model="whisper-large-v3-turbo",
      response_format="json",
      temperature=0.0
    )
    
    user_prompt = transcription.text.strip()
    if not user_prompt:
      raise HTTPException(status_code=400, detail="No audible speech detected.")
    
    existing_session = await db.sessions.find_one({"session_id": session_id, "user_id": user_id})
    if not existing_session:
      title = await generate_chat_title(user_prompt)
      await db.sessions.insert_one({
        "user_id": user_id,
        "session_id": session_id,
        "title": title,
        "created_at": now,
        "updated_at": now
      })
    else:
      await db.sessions.update_one({"session_id": session_id, "user_id": user_id}, {"$set": {"updated_at": now}})
      
    retriever = get_retriever(session_id=session_id, user_id=user_id, k=4)
    retrieved_docs = await retriever.ainvoke(user_prompt)
    chat_history = await get_recent_chat_history(session_id=session_id, user_id=user_id, limit=6)
    
    if retrieved_docs:
      chain = rag_prompt | llm | StrOutputParser()
      context_text = "\n\n".join(doc.page_content for doc in retrieved_docs)
      input_data = {
        "context": context_text,
        "chat_history": chat_history,
        "question": user_prompt
      }
    else:
      chain = general_prompt | llm | StrOutputParser()
      input_data = {
        "question": user_prompt,
        "chat_history": chat_history
      }
      
    bot_reply = await chain.ainvoke(input_data)
    
    await db.chat_history.insert_many([
      {"session_id": session_id, "user_id": user_id, "role": "user", "content": user_prompt, "timestamp": now},
      {"session_id": session_id, "user_id": user_id, "role": "assistant", "content": bot_reply, "timestamp": datetime.now(timezone.utc)}
    ])
    
    communicate = edge_tts.Communicate(bot_reply, VOICE_MODEL)
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_audio:
      temp_path = temp_audio.name
      
    await communicate.save(temp_path)
    
    with open(temp_path, "rb") as audio_f:
      audio_bytes = audio_f.read()
    os.remove(temp_path)
    
    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
    
    return VoiceResponse(
      user_text=user_prompt,
      assistant_text=bot_reply,
      audio_base64=audio_b64
    )
  except HTTPException:
    raise
  except Exception as e:
    logger.error(f"Voice chat pipeline error: {e}")
    raise HTTPException(status_code=500, detail=f"Voice processing failed: {str(e)}")
    
    
      
    
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from groq import AsyncGroq
from app.core.config import settings
from app.core.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audio", tags=["Audio"])

groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY.get_secret_value())

class TranscribeResponse(BaseModel):
  text: str
  
@router.post("/transcribe", response_model=TranscribeResponse, status_code=200)
async def transcribe_voice(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
  try:
    content = await file.read()
    if not content:
      raise HTTPException(status_code=400, detail="Empty audio recording.")
    
    transcription = await groq_client.audio.transcriptions.create(
      file=(file.filename or "recording.webm", content),
      model="whisper-large-v3-turbo",
      temperature=0.0,
      response_format="json",
    )
    
    return TranscribeResponse(text=transcription.text.strip())
  except HTTPException:
      raise
  except Exception as e:
    logger.error(f"Error transcribing microphone audio: {e}")
    raise HTTPException(status_code=500, detail=f"Failed to transcribe speech: {str(e)}")
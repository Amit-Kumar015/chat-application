import logging
import os
from datetime import datetime, timezone 
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from app.schemas.chat_schema import URLIngestRequest, IngestResponse
from app.services.document_service import parse_uploaded_file, parse_url, transcribe_media
from app.services.vector_service import add_documents_to_vectorstore
from app.core.database import get_database
from app.core.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/documents', tags=["Document Ingestion"])

MEDIA_EXTENSIONS = {
  ".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg", ".flac"
}

@router.post("/upload", response_model=IngestResponse, status_code=201)
async def upload_document(session_id: str = Form(...), file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
  if not file.filename:
    raise HTTPException(status_code=400, detail="No file uploaded")
  
  db = get_database()
  now = datetime.now(timezone.utc)
  ext = os.path.splitext(file.filename)[1].lower()
  user_id = current_user["user_id"]
  
  try:
    if ext in MEDIA_EXTENSIONS:
      chunks = await transcribe_media(file=file)
    else:
      chunks = await parse_uploaded_file(file)

    chunks_count = await add_documents_to_vectorstore(chunks, session_id=session_id, user_id=user_id)
  
    mime_type = file.content_type or f"file/{ext.lstrip('.')}"
    await db.documents.insert_one({
      "user_id": user_id,
      "session_id": session_id,
      "name": file.filename,
      "chunks_count": chunks_count,
      "type": mime_type,
      "created_at": now
    })
    
    await db.sessions.update_one(
      {"session_id": session_id, "user_id": user_id,},
      {"$set": {"updated_at": now}},
      upsert=True
    )
  
    return IngestResponse(
      session_id=session_id,
      status="success",
      chunks_count=chunks_count,
      source=file.filename
    )
  except Exception as e:
    logger.error(f"Error uploading document for session {session_id}: {e}")
    raise HTTPException(
      status_code=500,
      detail=f"Failed to process document: {str(e)}"
    )
  
@router.post("/ingest-url", response_model=IngestResponse, status_code=201)
async def ingest_web_url(payload: URLIngestRequest, current_user: dict = Depends(get_current_user)):
  db = get_database()
  now = datetime.now(timezone.utc)
  user_id = current_user["user_id"]
  
  try:
    url_str = str(payload.url)
    
    chunks = await parse_url(url_str)
    
    chunks_count = await add_documents_to_vectorstore(chunks, session_id=payload.session_id, user_id=user_id)
    
    await db.documents.insert_one({
      "user_id": user_id,
      "session_id": payload.session_id,
      "name": url_str,
      "type": "url",
      "chunks_count": chunks_count,
    })
    
    await db.sessions.update_one(
      {"session_id": payload.session_id, "user_id": user_id,},
      {"$set": {"updated_at": now}},
      upsert=True
    )

    return IngestResponse(
      session_id=payload.session_id,
      status="success",
      chunks_count=chunks_count,
      source=url_str
    )
  except Exception as e:
    logger.error(f"Error ingesting URL for session {payload.session_id}: {e}")
    raise HTTPException(
      status_code=500,
      detail=f"Failed to ingest URL: {str(e)}"
    )
  
@router.get("/{session_id}", status_code=200)
async def get_session_documents(session_id: str, current_user: dict = Depends(get_current_user)):
  db = get_database()
  user_id = current_user["user_id"]
  cursor = db.documents.find({"session_id": session_id, "user_id": user_id}).sort("created_at", 1)
  
  docs = []
  async for doc in cursor:
    docs.append({
      "name": doc.get("name"),
      "type": doc.get("type", "file"),
      "chunks_count": doc.get("chunks_count", 0),
      "created_at": doc.get("created_at")
    })
  return docs
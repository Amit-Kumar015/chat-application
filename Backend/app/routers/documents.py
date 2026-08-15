import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.schemas.chat_schema import URLIngestRequest, IngestResponse
from app.services.document_service import parse_uploaded_file, parse_url
from app.services.vector_service import add_documents_to_vectorstore
from app.core.database import get_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/documents', tags=["Document Ingestion"])

@router.post("/upload", response_model=IngestResponse, status_code=201)
async def upload_document(session_id: str = Form(...), file: UploadFile = File(...)):
  if not file.filename:
    raise HTTPException(status_code=400, detail="No file uploaded")
  
  chunks = await parse_uploaded_file(file)

  chunks_count = await add_documents_to_vectorstore(chunks, session_id=session_id)
  
  db = get_database()
  await db.documents.insert_one({
    "session_id": session_id,
    "filename": file.filename,
    "chunks_indexed": chunks_count,
    "content_type": file.content_type
  })
  
  return IngestResponse(
    session_id=session_id,
    status="success",
    chunk_indexed=chunks_count,
    source=file.filename
  )
  
@router.post("/ingest-url", response_model=IngestResponse, status_code=201)
async def ingest_web_url(payload: URLIngestRequest):
  url_str = str(payload.url)
  
  chunks = await parse_url(url_str)
  
  chunks_count = await add_documents_to_vectorstore(chunks, session_id=payload.session_id)
  
  db = get_database()
  await db.documents.insert_one({
      "session_id": payload.session_id,
      "url": url_str,
      "chunks_indexed": chunks_count,
  })

  return IngestResponse(
      session_id=payload.session_id,
      status="success",
      chunks_indexed=chunks_count,
      source=url_str
  )
  
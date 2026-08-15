from pydantic import BaseModel, Field, HttpUrl

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
  chunk_indexed: int
  source: str
import logging
from typing import List
from pymongo import MongoClient
from langchain_core.documents import Document
from langchain_mongodb.vectorstores import MongoDBAtlasVectorSearch
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from app.core.config import settings

logger = logging.getLogger(__name__)

embeddings = GoogleGenerativeAIEmbeddings(
  model="models/text-embedding-004",
  google_api_key=settings.GOOGLE_API_KEY.get_secret_value()
)

mongo_client = MongoClient(settings.MONGO_URI)
collection = mongo_client[settings.MONGO_DB_NAME]["vector_store"]

vector_store = MongoDBAtlasVectorSearch(
  collection=collection,
  embeddings=embeddings,
  index_name=settings.MONGO_VECTOR_INDEX_NAME,
  relevance_score_fn="cosine"
)

async def add_documents_to_vectorstore(documents: List[Document], session_id: str) -> int:
  if not documents:
    return 0
  
  for doc in documents:
    doc.metadata["session_id"] = session_id
    
  try:
    await vector_store.aadd_documents(documents)
    logger.info(f"Successfully embedded and saved {len(documents)} chunks for session {session_id}")
    return len(documents)
  except Exception as e:
    logger.error(f"Error adding documents to vector store: {e}")
    raise e
  
def get_retriever(session_id: str, k: int = 4):
  return vector_store.as_retriever(
    search_type="similarity",
    search_kwargs={
      "k": k,
      "pre_filter": {"session_id": {"$eq": session_id}}
    }
  )
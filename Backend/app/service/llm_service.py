import logging
from typing import List
from langchain_core.documents import Document
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from app.core.config import settings
from app.services.vector_service import get_retriever

logger = logging.getLogger(__name__)

primary_llm = ChatGoogleGenerativeAI(
  model="gemini-1.5-flash",
  api_key=settings.GOOGLE_API_KEY.get_secret_value(),
  temperature=0.3
)

if settings.GROQ_API_KEY:
  fallback_llm = ChatGroq(
    model_name="llama-3.3-70b-versatile",
    groq_api_key=settings.GROQ_API_KEY.get_secret_value(),
    temperature=0.3
  )
  
  llm = primary_llm.with_fallback([fallback_llm])
  logger.info("LLM service configured with Gemini (Primary) and Groq (Fallback).")
else:
  llm = primary_llm
  logger.info("LLM service configured with Gemini (Primary).")
  
RAG_PROMPT_TEMPLATE = """You are an intelligent AI assistant. Use the provided retrieved context to answer the user's question accurately.

If you don't know the answer or if the context doesn't contain enough information, simply state that you don't have enough information from the uploaded documents. Do not make up facts.

Context:
{context}

Question:
{question}

Answer:"""

GENERAL_PROMPT_TEMPLATE = """You are a helpful and intelligent AI assistant. Answer the user's question clearly and accurately.

Question:
{question}

Answer:"""

rag_prompt = ChatPromptTemplate.from_template(RAG_PROMPT_TEMPLATE)
general_prompt = ChatPromptTemplate.from_template(GENERAL_PROMPT_TEMPLATE)

def formate_docs(docs) -> str:
  return "\n\n".join(doc.page_content for doc in docs)

async def generate_rag_response(question: str, session_id: str) -> str:
  retriever = get_retriever(session_id=session_id, k=4)
  
  retrieved_docs: List[Document] = retriever.ainvoke(question)
  
  if retrieved_docs:
    logger.info(f"RAG Mode: Found {len(retrieved_docs)} chunks for session_id: {session_id}")
    context_text = formate_docs(retrieved_docs)
    chain = (
      {
        "context": context_text,
        "question": RunnablePassthrough()
      }
      | rag_prompt
      | llm
      | StrOutputParser()
    )
  else:
    logger.info(f"General Chat Mode: No documents found for session_id: {session_id}")
    chain = (
      {"question": RunnablePassthrough}
      | general_prompt
      | llm
      | StrOutputParser()
    )
  
  try:
    response = await chain.ainvoke(question)
    return response
  except Exception as e:
    logger.error(f"Error during RAG response generation: {e}")
    raise e
    

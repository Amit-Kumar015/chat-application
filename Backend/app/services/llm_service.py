import logging
from typing import List
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from app.core.config import settings
from app.services.vector_service import get_retriever
from app.core.database import get_database
from typing import AsyncGenerator

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
  
  llm = primary_llm.with_fallbacks([fallback_llm])
  logger.info("LLM service configured with Gemini (Primary) and Groq (Fallback).")
else:
  llm = primary_llm
  logger.info("LLM service configured with Gemini (Primary).")
  
RAG_PROMPT_TEMPLATE = [
  ("system", "You are an intelligent AI assistant. Answer the user's question using the provided context and prior conversation history. If the context does not contain enough information, state that you do not have enough information from the uploaded documents.\n\nContext:\n{context}"),
  MessagesPlaceholder(variable_name="chat_history"),
  ("human", "{question}"),
]

GENERAL_PROMPT_TEMPLATE = [
  ("system", "You are a helpful and intelligent AI assistant. Answer the user's questions clearly and accurately using the conversation history when relevant."),
  MessagesPlaceholder(variable_name="chat_history"),
  ("human", "{question}"),
]

TITLE_PROMPT_TEMPLATE = """You are a helpful assistant. Generate a short, concise, and descriptive title (3 to 5 words maximum) for a chat conversation that begins with the following user message. Do not use quotes, punctuation, or preamble.

User Message:
{message}

Title:"""


rag_prompt = ChatPromptTemplate.from_messages(RAG_PROMPT_TEMPLATE)
general_prompt = ChatPromptTemplate.from_messages(GENERAL_PROMPT_TEMPLATE)
title_prompt = ChatPromptTemplate.from_template(TITLE_PROMPT_TEMPLATE)

def format_docs(docs) -> str:
  return "\n\n".join(doc.page_content for doc in docs)

async def get_recent_chat_history(session_id: str, limit: int = 6) -> List[BaseMessage]:
  db = get_database()
  cursor = db.chat_history.find({"session_id": session_id}).sort("timestamp", -1).limit(limit)
  
  docs = []
  async for item in cursor:
    docs.append(item)
    
  docs.reverse()
  
  history: List[BaseMessage] = []
  for item in docs:
    if item.get("role") == "user":
      history.append(HumanMessage(content=item.get("content", "")))
    elif item.get("role") == "assistant":
      history.append(AIMessage(content=item.get("content", "")))
      
  return history

async def stream_rag_response(question: str, session_id: str) -> AsyncGenerator[str, None]:
  retriever = get_retriever(session_id=session_id, k=4)
  
  retrieved_docs: List[Document] = await retriever.ainvoke(question)
  chat_history: List[BaseMessage] = await get_recent_chat_history(session_id=session_id, limit=6)
  
  if retrieved_docs:
    logger.info(f"RAG Mode: Found {len(retrieved_docs)} chunks for session_id: {session_id}")
    context_text = format_docs(retrieved_docs)
    chain = rag_prompt | llm | StrOutputParser()
    input_data = {"context": context_text, "chat_history": chat_history, "question": question}
  else:
    logger.info(f"General Chat Mode: No documents found for session_id: {session_id}")
    chain = general_prompt | llm | StrOutputParser()
    input_data = {"question": question, "chat_history": chat_history}
    
  async for chunk in chain.astream(input_data):
    yield chunk

async def generate_chat_title(first_message: str) -> str:
  try:
    title_chain = title_prompt | llm | StrOutputParser()
    raw_title = await title_chain.ainvoke({"message": first_message})
    return raw_title.strip().replace('"', "")
  except Exception as e:
    logger.error(f"Error generating chat title: {e}")
    words = first_message.strip().split()
    return " ".join(words[:4]) if words else "New Chat"
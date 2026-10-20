import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

# Database configuration
# Accepts DATABASE_URL from .env, or individual MYSQL_* env variables.
# Gracefully falls back to SQLite for zero-config local development and student demos.
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    mysql_user = os.getenv("MYSQL_USER")
    mysql_password = os.getenv("MYSQL_PASSWORD")
    mysql_host = os.getenv("MYSQL_HOST")
    mysql_port = os.getenv("MYSQL_PORT", "3306")
    mysql_db = os.getenv("MYSQL_DATABASE")

    if mysql_user and mysql_host and mysql_db:
        DATABASE_URL = f"mysql+mysqlconnector://{mysql_user}:{mysql_password or ''}@{mysql_host}:{mysql_port}/{mysql_db}"
    else:
        # Default fallback to SQLite
        DATABASE_URL = os.getenv("SQLITE_URL", "sqlite:///./project21.db")

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency that provides a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

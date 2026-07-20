"""
面试助手核心配置
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    deepseek_api_key: str = os.getenv("DEEPSEEK_API_KEY", "")
    deepseek_base_url: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    llm_model: str = os.getenv("LLM_MODEL", "deepseek-v4-flash")
    server_port: int = int(os.getenv("SERVER_PORT", "3001"))
    temperature: float = 0.7
    max_tokens: int = 500
    mineru_api_token: str = os.getenv("MINERU_API_TOKEN", "")
    # 硅基流动（嵌入模型）
    siliconflow_api_key: str = os.getenv("SILICONFLOW_API_KEY", "")
    siliconflow_base_url: str = os.getenv("SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1")
    # Milvus
    milvus_host: str = os.getenv("MILVUS_HOST", "localhost")
    milvus_port: int = int(os.getenv("MILVUS_PORT", "19530"))
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
    # MySQL
    mysql_host: str = os.getenv("MYSQL_HOST", "localhost")
    mysql_port: int = int(os.getenv("MYSQL_PORT", "3307"))
    mysql_user: str = os.getenv("MYSQL_USER", "root")
    mysql_password: str = os.getenv("MYSQL_PASSWORD", "interview123")
    mysql_database: str = os.getenv("MYSQL_DATABASE", "interview_assistant")
    # Redis
    redis_host: str = os.getenv("REDIS_HOST", "localhost")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    # JWT
    jwt_secret: str = os.getenv("JWT_SECRET", "interview-assistant-secret-key-change-me")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    jwt_expire_hours: int = int(os.getenv("JWT_EXPIRE_HOURS", "72"))
    # 简历在 Redis 中的 TTL（秒）
    resume_redis_ttl: int = 3 * 24 * 3600  # 3 天


config = Config()


def validate_config():
    if not config.deepseek_api_key:
        print("[WARN] DEEPSEEK_API_KEY 未设置，请复制 .env.example 为 .env 并填入 API Key")

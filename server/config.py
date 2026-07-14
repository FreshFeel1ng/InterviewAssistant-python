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


config = Config()


def validate_config():
    if not config.deepseek_api_key:
        print("[WARN] DEEPSEEK_API_KEY 未设置，请复制 .env.example 为 .env 并填入 API Key")

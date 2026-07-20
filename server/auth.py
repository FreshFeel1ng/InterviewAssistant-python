"""
用户认证模块

MySQL 存储用户账号，Redis 管理 Session + 简历缓存。
Token TTL 3 天，简历 Redis 缓存 TTL 3 天。
"""
import hashlib
import json
import time
from dataclasses import dataclass
from typing import Optional

import jwt
import pymysql
import redis
from passlib.hash import bcrypt

from server.config import config


# ==================== MySQL 连接 ====================

def _get_mysql_conn():
    return pymysql.connect(
        host=config.mysql_host,
        port=config.mysql_port,
        user=config.mysql_user,
        password=config.mysql_password,
        database=config.mysql_database,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


def _init_db():
    """初始化数据库表（docker-compose 已通过 init.sql 创建，这里做兜底）"""
    try:
        conn = _get_mysql_conn()
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
        conn.commit()
        conn.close()
        print("[Auth] 数据库初始化完成")
    except Exception as e:
        print(f"[Auth] 数据库初始化失败（可能 MySQL 未启动）: {e}")


# ==================== Redis 连接 ====================

_redis_client: Optional[redis.Redis] = None


def get_redis() -> Optional[redis.Redis]:
    global _redis_client
    if _redis_client is not None:
        try:
            _redis_client.ping()
            return _redis_client
        except Exception:
            _redis_client = None

    try:
        _redis_client = redis.Redis(
            host=config.redis_host,
            port=config.redis_port,
            decode_responses=True,
        )
        _redis_client.ping()
        print("[Auth] Redis 连接成功")
        return _redis_client
    except Exception as e:
        print(f"[Auth] Redis 连接失败（可能未启动）: {e}")
        return None


# ==================== 数据模型 ====================

@dataclass
class User:
    id: int
    username: str
    created_at: str = ""


@dataclass
class LoginResult:
    success: bool
    token: str = ""
    user: Optional[User] = None
    error: str = ""


# ==================== 注册/登录 ====================

def register(username: str, password: str) -> LoginResult:
    """注册新用户"""
    if not username or not password:
        return LoginResult(success=False, error="用户名和密码不能为空")
    if len(username) < 3 or len(username) > 50:
        return LoginResult(success=False, error="用户名长度需在 3-50 之间")
    if len(password) < 6:
        return LoginResult(success=False, error="密码长度不能少于 6 位")

    conn = _get_mysql_conn()
    try:
        with conn.cursor() as cur:
            # 检查用户名是否已存在
            cur.execute("SELECT id FROM users WHERE username = %s", (username,))
            if cur.fetchone():
                return LoginResult(success=False, error="用户名已存在")

            # 创建用户
            password_hash = bcrypt.hash(password)
            cur.execute(
                "INSERT INTO users (username, password_hash) VALUES (%s, %s)",
                (username, password_hash),
            )
            user_id = cur.lastrowid
        conn.commit()

        user = User(id=user_id, username=username)
        token = _create_token(user)

        # 在 Redis 中创建 session
        _save_session(user.id, token)

        return LoginResult(success=True, token=token, user=user)
    except Exception as e:
        return LoginResult(success=False, error=f"注册失败: {str(e)}")
    finally:
        conn.close()


def login(username: str, password: str) -> LoginResult:
    """用户登录"""
    conn = _get_mysql_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, password_hash, created_at FROM users WHERE username = %s",
                (username,),
            )
            row = cur.fetchone()

        if not row:
            return LoginResult(success=False, error="用户名或密码错误")

        if not bcrypt.verify(password, row["password_hash"]):
            return LoginResult(success=False, error="用户名或密码错误")

        user = User(id=row["id"], username=row["username"], created_at=str(row["created_at"]))
        token = _create_token(user)

        # 在 Redis 中创建 session
        _save_session(user.id, token)

        return LoginResult(success=True, token=token, user=user)
    except Exception as e:
        return LoginResult(success=False, error=f"登录失败: {str(e)}")
    finally:
        conn.close()


# ==================== JWT Token ====================

def _create_token(user: User) -> str:
    """生成 JWT Token"""
    payload = {
        "user_id": user.id,
        "username": user.username,
        "exp": int(time.time()) + config.jwt_expire_hours * 3600,
        "iat": int(time.time()),
    }
    return jwt.encode(payload, config.jwt_secret, algorithm=config.jwt_algorithm)


def verify_token(token: str) -> Optional[User]:
    """验证 JWT Token，返回 User 或 None"""
    try:
        payload = jwt.decode(token, config.jwt_secret, algorithms=[config.jwt_algorithm])
        return User(
            id=payload["user_id"],
            username=payload["username"],
        )
    except jwt.ExpiredSignatureError:
        print("[Auth] Token 已过期")
        return None
    except jwt.InvalidTokenError:
        print("[Auth] Token 无效")
        return None


# ==================== Redis Session + 简历缓存 ====================

def _save_session(user_id: int, token: str):
    """在 Redis 中保存 session"""
    r = get_redis()
    if not r:
        return
    key = f"session:{user_id}"
    r.setex(key, config.jwt_expire_hours * 3600, token)


def get_session(user_id: int) -> Optional[str]:
    """从 Redis 获取 session token"""
    r = get_redis()
    if not r:
        return None
    return r.get(f"session:{user_id}")


def save_resume_to_redis(user_id: int, resume_data: dict):
    """将简历数据缓存到 Redis，TTL 3 天"""
    r = get_redis()
    if not r:
        return
    key = f"resume:{user_id}"
    r.setex(key, config.resume_redis_ttl, json.dumps(resume_data, ensure_ascii=False))
    print(f"[Redis] 简历已缓存: user_id={user_id}")


def load_resume_from_redis(user_id: int) -> Optional[dict]:
    """从 Redis 加载简历缓存"""
    r = get_redis()
    if not r:
        return None
    data = r.get(f"resume:{user_id}")
    if data:
        print(f"[Redis] 从缓存加载简历: user_id={user_id}")
        return json.loads(data)
    return None


def extend_resume_ttl(user_id: int):
    """延长简历缓存 TTL"""
    r = get_redis()
    if not r:
        return
    r.expire(f"resume:{user_id}", config.resume_redis_ttl)


# ==================== 初始化 ====================

# 模块加载时尝试初始化数据库
_init_db()

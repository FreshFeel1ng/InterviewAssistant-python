"""
面试助手后端服务 - FastAPI + WebSocket
"""
import json
import uuid
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from server.config import config, validate_config
from server.agent import InterviewAgent
from server.speech import preprocess_transcript, is_complete_question, extract_question

validate_config()

app = FastAPI(title="Interview Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SessionConfig(BaseModel):
    interview_type: str = "技术面试"
    candidate_background: str = "全栈开发工程师"
    language: str = "zh"


class SessionManager:
    """管理 Agent 会话"""

    def __init__(self):
        self.sessions: dict[str, dict] = {}

    def create_session(self, cfg: Optional[SessionConfig] = None) -> dict:
        session_id = str(uuid.uuid4())
        agent = InterviewAgent()
        session = {
            "id": session_id,
            "agent": agent,
            "config": cfg or SessionConfig(),
        }
        self.sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[dict]:
        return self.sessions.get(session_id)

    def remove_session(self, session_id: str):
        self.sessions.pop(session_id, None)


session_manager = SessionManager()


# ============ REST API ============

@app.get("/api/health")
async def health():
    return {"status": "ok", "sessions": len(session_manager.sessions)}


@app.post("/api/sessions")
async def create_session(cfg: Optional[SessionConfig] = None):
    session = session_manager.create_session(cfg)
    return {"sessionId": session["id"], "config": session["config"].model_dump()}


# ============ WebSocket ============

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()

    session = session_manager.create_session()

    # 发送会话信息
    await ws.send_json({
        "type": "config",
        "payload": {
            "sessionId": session["id"],
            "config": session["config"].model_dump(),
        },
    })

    try:
        while True:
            data = await ws.receive_json()

            msg_type = data.get("type")

            if msg_type == "transcript":
                payload = data.get("payload", {})
                text = preprocess_transcript(payload.get("text", ""))
                is_final = payload.get("isFinal", False)

                # 只在最终识别结果时触发回答
                if is_final and is_complete_question(text):
                    question = extract_question(text)
                    if not question or len(question) < 5:
                        continue

                    print(f"[Agent] 收到问题: {question}")

                    # 通知前端开始生成
                    await ws.send_json({
                        "type": "status",
                        "payload": {"status": "thinking", "message": "正在生成回答..."},
                    })

                    try:
                        agent: InterviewAgent = session["agent"]
                        s_cfg = session["config"]

                        async for chunk in agent.generate_answer_stream(
                            question=question,
                            interview_type=s_cfg.interview_type,
                            candidate_background=s_cfg.candidate_background,
                            language=s_cfg.language,
                        ):
                            await ws.send_json({
                                "type": "answer_chunk",
                                "payload": {
                                    "id": f"ans_{uuid.uuid4().hex[:8]}",
                                    "chunk": chunk,
                                    "isComplete": False,
                                },
                            })

                        # 发送完成信号
                        await ws.send_json({
                            "type": "answer_chunk",
                            "payload": {
                                "id": f"ans_{uuid.uuid4().hex[:8]}",
                                "chunk": "",
                                "isComplete": True,
                            },
                        })

                        print(f"[Agent] 回答完成")

                    except Exception as e:
                        print(f"[Agent] 生成回答失败: {e}")
                        await ws.send_json({
                            "type": "error",
                            "payload": {"message": f"生成回答失败: {str(e)}"},
                        })

                    # 恢复聆听状态
                    await ws.send_json({
                        "type": "status",
                        "payload": {"status": "listening", "message": "继续聆听..."},
                    })

            elif msg_type == "config":
                payload = data.get("payload", {})
                for key in ["interview_type", "candidate_background", "language"]:
                    if key in payload:
                        setattr(session["config"], key, payload[key])

                await ws.send_json({
                    "type": "config",
                    "payload": {
                        "sessionId": session["id"],
                        "config": session["config"].model_dump(),
                    },
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS] 错误: {e}")
    finally:
        session_manager.remove_session(session["id"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server.main:app",
        host="0.0.0.0",
        port=config.server_port,
        reload=True,
    )

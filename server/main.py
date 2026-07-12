"""
面试助手后端服务 - FastAPI + WebSocket
"""
import asyncio
import uuid
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from server.config import config, validate_config
from server.agent import InterviewAgent
from server.speech import preprocess_transcript, is_complete_question, extract_question
from server.audio_capture import SystemAudioCapture, WhisperTranscriber

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
    temperature: float = 0.7
    max_tokens: int = 500
    model: str = "deepseek-v4-flash"


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

            elif msg_type == "start_audio_capture":
                await _handle_start_audio_capture(ws, session)

            elif msg_type == "stop_audio_capture":
                await _handle_stop_audio_capture(session)

            elif msg_type == "list_audio_devices":
                cap = SystemAudioCapture()
                cap.list_devices()

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS] 错误: {e}")
    finally:
        if session.get("audio_capture"):
            session["audio_capture"].stop()
        session_manager.remove_session(session["id"])


async def _handle_start_audio_capture(ws: WebSocket, session: dict):
    """启动系统音频捕获 + Whisper 识别"""
    cap = SystemAudioCapture()
    transcriber = WhisperTranscriber()

    last_text = ""

    def on_transcript(text: str, is_final: bool):
        """Whisper 识别回调：通过 asyncio 发送到 WebSocket"""
        nonlocal last_text
        if text and text != last_text:
            last_text = text
            asyncio.create_task(ws.send_json({
                "type": "transcript_update",
                "payload": {"text": text, "source": "whisper"},
            }))

    async def process_loop():
        """持续处理音频块并送 Whisper 识别"""
        while cap.is_running:
            await asyncio.sleep(1.5)  # 每 1.5 秒检查一次
            chunk = cap.get_chunk()
            if chunk is None:
                continue

            text = await transcriber.transcribe(chunk)
            if not text:
                continue

            # 推送转写结果
            await ws.send_json({
                "type": "transcript_update",
                "payload": {"text": text, "source": "whisper"},
            })

            # 检查是否形成完整问题 → 触发 AI 回答
            processed = preprocess_transcript(text)
            if is_complete_question(processed):
                question = extract_question(processed)
                if question and len(question) >= 5:
                    print(f"[Agent] 收到问题(音频): {question}")
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

                        await ws.send_json({
                            "type": "answer_chunk",
                            "payload": {
                                "id": f"ans_{uuid.uuid4().hex[:8]}",
                                "chunk": "",
                                "isComplete": True,
                            },
                        })
                        print("[Agent] 回答完成(音频)")

                    except Exception as e:
                        print(f"[Agent] 生成回答失败: {e}")

                    await ws.send_json({
                        "type": "status",
                        "payload": {"status": "listening", "message": "继续聆听..."},
                    })

    cap.start(on_transcript)
    session["audio_capture"] = cap
    session["audio_task"] = asyncio.create_task(process_loop())

    print("[Audio] 系统音频捕获已启动")


async def _handle_stop_audio_capture(session: dict):
    """停止系统音频捕获"""
    cap = session.get("audio_capture")
    if cap:
        cap.stop()
        session["audio_capture"] = None
    task = session.get("audio_task")
    if task:
        task.cancel()
        session["audio_task"] = None
    print("[Audio] 系统音频捕获已停止")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server.main:app",
        host="0.0.0.0",
        port=config.server_port,
        reload=True,
    )

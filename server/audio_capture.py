"""
系统音频捕获模块

捕获 Windows 系统音频输出（腾讯会议的声音），通过 WebSocket 实时推送到前端，
或直接在服务端调用 Whisper API 转文字。

两种模式：
1. 连续捕获 → 每 N 秒切割 → 送 Whisper API 识别 → 推送结果
2. VAD 检测 → 有声音才开始录制 → 静音停止 → 识别 → 推送结果
"""
import asyncio
import io
import wave
import threading
from typing import Optional, Callable

import numpy as np
import sounddevice as sd
from openai import OpenAI

from server.config import config


class SystemAudioCapture:
    """捕获系统音频输出设备的声音"""

    def __init__(self, sample_rate: int = 16000):
        self.sample_rate = sample_rate
        self.chunk_duration = 3.0  # 每 3 秒切割一次
        self.chunk_samples = int(sample_rate * self.chunk_duration)
        self.is_running = False
        self._buffer = []
        self._thread: Optional[threading.Thread] = None
        self._on_transcript: Optional[Callable] = None

    def _find_loopback_device(self) -> Optional[int]:
        """查找可用的音频回环设备（Stereo Mix / VB-Cable 等）"""
        devices = sd.query_devices()
        for i, dev in enumerate(devices):
            name = dev["name"].lower()
            # Windows 立体声混音 / VB-Cable
            if any(kw in name for kw in ["stereo mix", "立体声混音", "loopback", "cable", "voicemeeter"]):
                if dev["max_input_channels"] > 0:
                    return i
        # 没找到就用默认输入设备（后续可手动指定）
        return None

    def _audio_callback(self, indata: np.ndarray, frames, time_info, status):
        """音频回调：把捕获的音频数据放入缓冲区"""
        if status:
            print(f"[Audio] 状态: {status}")
        self._buffer.append(indata.copy())

    def start(self, on_transcript: Callable[[str, bool], None]):
        """开始捕获系统音频"""
        self._on_transcript = on_transcript
        self._buffer = []
        self.is_running = True

        device = self._find_loopback_device()
        if device is not None:
            dev_info = sd.query_devices(device)
            print(f"[Audio] 使用设备: {dev_info['name']}")
        else:
            print("[Audio] 未找到回环设备，使用默认输入")
            # 列出可用设备供参考
            print("[Audio] 可用设备列表:")
            for i, dev in enumerate(sd.query_devices()):
                if dev["max_input_channels"] > 0:
                    print(f"  [{i}] {dev['name']}")

        def _run():
            try:
                with sd.InputStream(
                    device=device,
                    channels=1,
                    samplerate=self.sample_rate,
                    callback=self._audio_callback,
                    blocksize=int(self.sample_rate * 0.1),  # 100ms 块
                ):
                    while self.is_running:
                        sd.sleep(100)
            except Exception as e:
                print(f"[Audio] 捕获异常: {e}")
                self.is_running = False

        self._thread = threading.Thread(target=_run, daemon=True)
        self._thread.start()

    def stop(self):
        """停止捕获"""
        self.is_running = False
        if self._thread:
            self._thread.join(timeout=2)

    def get_chunk(self) -> Optional[bytes]:
        """获取一段音频数据（WAV 格式），用于发送给 Whisper API"""
        if len(self._buffer) < 2:
            return None

        # 合并 buffer 中的数据
        audio_data = np.concatenate(self._buffer, axis=0)
        self._buffer = []

        # 如果数据太多，只取最近 chunk_samples 个
        if len(audio_data) > self.chunk_samples:
            audio_data = audio_data[-self.chunk_samples:]

        # 检查是否有有效音频（VAD 简单判断：能量阈值）
        energy = np.sqrt(np.mean(audio_data ** 2))
        if energy < 0.005:  # 太安静，跳过
            return None

        # 转为 16-bit PCM WAV
        audio_int16 = (audio_data * 32767).astype(np.int16)

        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(self.sample_rate)
            wf.writeframes(audio_int16.tobytes())

        return wav_buffer.getvalue()

    def list_devices(self):
        """列出所有音频设备"""
        print("\n[Audio] 音频设备列表:")
        print("=" * 60)
        for i, dev in enumerate(sd.query_devices()):
            in_ch = dev["max_input_channels"]
            out_ch = dev["max_output_channels"]
            name = dev["name"]
            hostapi = sd.query_hostapis(dev["hostapi"])["name"]
            if in_ch > 0:
                print(f"  [{i}] {name}")
                print(f"       输入: {in_ch}ch, 输出: {out_ch}ch, 驱动: {hostapi}")
        print("=" * 60)


class WhisperTranscriber:
    """使用 OpenAI/DeepSeek Whisper API 做语音转文字"""

    def __init__(self):
        self.client = OpenAI(
            api_key=config.deepseek_api_key,
            base_url=config.deepseek_base_url,
        )

    async def transcribe(self, audio_data: bytes) -> Optional[str]:
        """将音频数据转为文字（异步，在线程池中执行）"""
        loop = asyncio.get_event_loop()
        try:
            result = await loop.run_in_executor(
                None,
                lambda: self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=("audio.wav", audio_data, "audio/wav"),
                    language="zh",
                    response_format="text",
                )
            )
            # result 可能是字符串或对象
            if isinstance(result, str):
                return result.strip()
            return result.text.strip() if hasattr(result, 'text') else str(result).strip()
        except Exception as e:
            print(f"[Whisper] 识别失败: {e}")
            return None

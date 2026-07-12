import { useRef, useCallback, useEffect, useState } from 'react';

// Web Speech API 类型声明
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface UseSpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    language = 'zh-CN',
    continuous = true,
    interimResults = true,
    onResult,
    onError,
  } = options;

  const recognitionRef = useRef<any>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // 检查浏览器支持
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  // 初始化识别器
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const text = finalTranscript || interimTranscript;
      if (text) {
        onResult?.(text, !!finalTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[Speech] 识别错误:', event.error);
      onError?.(event.error);

      // 'no-speech' 错误时自动重启
      if (event.error === 'no-speech') {
        try {
          recognition.start();
        } catch {
          // 忽略重启错误
        }
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // 如果是连续模式且没有被手动停止，自动重启
      if (continuous && recognitionRef.current) {
        try {
          recognition.start();
          setIsListening(true);
        } catch {
          // 忽略
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {
        // 忽略
      }
    };
  }, [isSupported, language, continuous, interimResults, onResult, onError]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err) {
      console.error('[Speech] 启动失败:', err);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
      setIsListening(false);
    } catch (err) {
      console.error('[Speech] 停止失败:', err);
    }
  }, []);

  return {
    startListening,
    stopListening,
    isSupported,
    isListening,
  };
}

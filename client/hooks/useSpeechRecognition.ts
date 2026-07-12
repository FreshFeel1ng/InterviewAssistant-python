import { useRef, useCallback, useEffect, useState } from 'react';

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
  const manuallyStoppedRef = useRef(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const createRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

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

      // 'no-speech' 或 'aborted' 时自动重启（仅非手动停止）
      if ((event.error === 'no-speech' || event.error === 'aborted') && !manuallyStoppedRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
            setIsListening(true);
          } catch {
            // 忽略
          }
        }, 200);
      }
    };

    recognition.onend = () => {
      // 如果非手动停止，自动重启
      if (!manuallyStoppedRef.current) {
        try {
          recognition.start();
        } catch {
          // 如果 start 失败（可能还没准备好），延迟重试
          setTimeout(() => {
            if (!manuallyStoppedRef.current) {
              try {
                recognitionRef.current?.start();
                setIsListening(true);
              } catch {
                // 忽略
              }
            }
          }, 300);
        }
      } else {
        setIsListening(false);
      }
    };

    return recognition;
  }, [language, continuous, interimResults, onResult, onError]);

  // 初始化 recognition
  useEffect(() => {
    if (!isSupported) return;
    recognitionRef.current = createRecognition();
  }, [isSupported, createRecognition]);

  const startListening = useCallback(() => {
    manuallyStoppedRef.current = false;

    // 如果 recognition 不存在或状态不对，重新创建
    if (!recognitionRef.current || recognitionRef.current.aborted) {
      recognitionRef.current = createRecognition();
    }

    try {
      recognitionRef.current?.start();
      setIsListening(true);
    } catch (err: any) {
      // 如果已经在运行中，忽略错误
      if (err?.message !== "already started") {
        console.error('[Speech] 启动失败:', err);
        // 重建 recognition 再试
        recognitionRef.current = createRecognition();
        try {
          recognitionRef.current?.start();
          setIsListening(true);
        } catch (e2) {
          console.error('[Speech] 重建后启动仍失败:', e2);
        }
      }
    }
  }, [createRecognition]);

  const stopListening = useCallback(() => {
    manuallyStoppedRef.current = true;
    setIsListening(false);

    try {
      recognitionRef.current?.stop();
    } catch {
      // 忽略
    }
  }, []);

  return {
    startListening,
    stopListening,
    isSupported,
    isListening,
  };
}

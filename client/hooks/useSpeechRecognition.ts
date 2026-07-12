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
  const stoppedRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const createAndStart = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // 先中止旧的
    try {
      recognitionRef.current?.abort();
    } catch {}

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
        optionsRef.current.onResult?.(text, !!finalTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.log('[Speech] 识别事件:', event.error);
      // no-speech 时自动重启
      if (event.error === 'no-speech') {
        setTimeout(() => {
          try { recognition.start(); } catch {}
        }, 200);
        return;
      }
      // 非致命错误不处理
      if (event.error === 'aborted') return;
      optionsRef.current.onError?.(event.error);
    };

    recognition.onend = () => {
      // 用户手动停止 → 不重启
      if (stoppedRef.current) {
        setIsListening(false);
        return;
      }
      // 自动结束（长时间静音等） → 自动重启
      setTimeout(() => {
        if (!stoppedRef.current) {
          try {
            recognition.start();
            setIsListening(true);
          } catch {
            // 如果 start 失败，重建实例
            const SpeechRecognition =
              (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            const newRec = new SpeechRecognition();
            newRec.continuous = continuous;
            newRec.interimResults = interimResults;
            newRec.lang = language;
            newRec.onresult = recognition.onresult;
            newRec.onerror = recognition.onerror;
            newRec.onend = recognition.onend;
            recognitionRef.current = newRec;
            try { newRec.start(); setIsListening(true); } catch {}
          }
        }
      }, 300);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error('[Speech] start 失败:', err);
    }
  }, [language, continuous, interimResults]);

  const startListening = useCallback(() => {
    stoppedRef.current = false;
    createAndStart();
  }, [createAndStart]);

  const stopListening = useCallback(() => {
    stoppedRef.current = true;
    setIsListening(false);
    try {
      recognitionRef.current?.abort();
    } catch {}
    recognitionRef.current = null;
  }, []);

  return {
    startListening,
    stopListening,
    isSupported,
    isListening,
  };
}

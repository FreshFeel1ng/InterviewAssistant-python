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
      setIsListening(false);
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
    createAndStart();
  }, [createAndStart]);

  const stopListening = useCallback(() => {
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

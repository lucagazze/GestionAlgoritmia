import { useEffect, useState, useRef, useCallback } from 'react';

interface UseSpeechRecognitionProps {
  onResult?: (transcript: string) => void;
  lang?: string;
  continuous?: boolean;
}

export const useSpeechRecognition = ({ 
  onResult, 
  lang = 'es-AR', 
  continuous = true 
}: UseSpeechRecognitionProps = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    // Check browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Browser does not support Speech Recognition');
      return;
    }

    // Stop previous instance if exists
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = true; // We want real-time feedback
    recognition.lang = lang;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let finalDetails = '';
      let interimDetails = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalDetails += event.results[i][0].transcript;
        } else {
          interimDetails += event.results[i][0].transcript;
        }
      }

      if (finalDetails) {
        setTranscript(prev => {
            const newTranscript = prev + ' ' + finalDetails;
            if (onResult) onResult(newTranscript);
            return newTranscript;
        });
      }
      
      setInterimTranscript(interimDetails);
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone permission denied');
        setIsListening(false);
      }
      // 'aborted' or 'no-speech' are common, non-critical errors
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart if it was supposed to be continuous and wasn't explicitly stopped by user
      // Note: This logic can be complex; for now we let the UI handle restarts or just stop.
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch(e) {
      console.error("Failed to start recognition:", e);
    }
  }, [lang, continuous, onResult]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    error,
    supported: !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  };
};

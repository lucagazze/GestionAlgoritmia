import { useEffect, useState, useRef, useCallback } from 'react';

export const useWakeWord = (isActive: boolean, onWake: () => void) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Restart function to handle recursion safely
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'es-AR';

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      const lastResultIndex = event.results.length - 1;
      const transcript = event.results[lastResultIndex][0].transcript.toLowerCase().trim();
      console.log("👂 Heard (Raw):", transcript);

      // Relaxed matching for debugging
      if (transcript.includes('jarvis') || transcript.includes('yervis') || transcript.includes('service') || transcript.includes('hola')) {
        console.log("🚀 Wake Word Detected!");
        recognition.stop();
        onWake();
      }
    };

    recognition.onerror = (event: any) => {
        // 'aborted' is common when stopping or restarting, ignore it to prevent console spam
        if (event.error === 'aborted') return; 
        
        console.warn("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
            setError('Microphone permission denied');
            setIsListening(false);
        }
    };

    recognition.onend = () => {
      setIsListening(false);
      // Only restart if we still want it active
      if (isActive) {
        // Increased delay to 1s to prevent aggressive loops if browser keeps aborting
        setTimeout(() => {
            if (!recognitionRef.current) return; // Component might have unmounted
            try { 
                recognition.start(); 
            } catch(e) { 
                // Ignore errors if already started
            }
        }, 1000);
      }
    };

    recognitionRef.current = recognition;
    try {
        recognition.start();
    } catch(e) {
        console.error("Failed to start recognition:", e);
    }
  }, [isActive, onWake]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
       console.warn("Browser does not support Speech Recognition");
       return;
    }

    if (isActive) {
        startListening();
    } else {
        if (recognitionRef.current) recognitionRef.current.stop();
        setIsListening(false);
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [isActive, startListening]);

  return { isListening, error };
};

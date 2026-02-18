import React, { useEffect, useRef, useMemo } from 'react';

interface ScriptReaderProps {
  script: string;
  transcript: string;
  fontSize: number;
  isListening: boolean;
}

export const ScriptReader: React.FC<ScriptReaderProps> = ({ 
  script, 
  transcript, 
  fontSize,
  isListening 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);

  // Helper to normalize text for comparison (remove punctuation, lowercase)
  const normalize = (text: string) => {
    return text.toLowerCase().replace(/[^\w\s\u00C0-\u00FF]/g, '');
  };

  // Convert script into tokens (words) with their original representation
  const scriptTokens = useMemo(() => {
    return script.split(/(\s+)/).filter(t => t.length > 0);
  }, [script]);

  // Determine which words have been spoken
  // This is a naive implementation. For better results, one would use a proper diff algorithm (like diff-match-patch)
  // or a fuzzy search. Here we just look for sequence matches.
  const spokenWordsCount = useMemo(() => {
    const cleanTranscript = normalize(transcript).split(/\s+/).filter(w => w.length > 0);
    const cleanScript = normalize(script).split(/\s+/).filter(w => w.length > 0);
    
    // Find the furthest point in the script that matches the transcript
    // We look for the last 3 words of transcript in the script to sync position
    if (cleanTranscript.length === 0) return 0;

    // Simple strategy: Just try to match from the start and see how far we get
    // This assumes the user reads linearly. 
    // If they skip, this might get stuck, but it's a start.
    let scriptIdx = 0;
    let transcriptIdx = 0;
    let matchCount = 0;

    // We can try to be smarter: find the last window of transcript words in the script
    const windowSize = 5;
    const recentTranscript = cleanTranscript.slice(-windowSize); // Last 5 words spoken
    
    // Search for this sequence in the script
    // This is computationally expensive for long scripts on every render, but should be okay for small texts.
    // For a robust implementation, we'd use a more complex stateful matcher.
    
    // Let's stick to a simpler "start-to-end" match for version 1, 
    // but allow skipping if we find a match a bit ahead.
    
    let lastMatchIndex = -1;

    // Try to map each transcript word to a script word
    for (let t = 0; t < cleanTranscript.length; t++) {
        const tWord = cleanTranscript[t];
        
        // Search forward from last match
        // We limit lookahead to 20 words to avoid jumping too far on common words like "de", "la"
        const lookahead = 20;
        let found = false;

        for (let s = lastMatchIndex + 1; s < Math.min(lastMatchIndex + lookahead, cleanScript.length); s++) {
            if (cleanScript[s] === tWord) {
                lastMatchIndex = s;
                found = true;
                break;
            }
        }
    }

    return lastMatchIndex + 1; // Number of words matched in the cleaned script
  }, [script, transcript]);

  // Reconstruct UI with highlighting
  const renderContent = () => {
    const cleanScriptWords = normalize(script).split(/\s+/).filter(w => w.length > 0);
    let currentCleanWordIndex = 0;
    
    return scriptTokens.map((token, idx) => {
        const isWhitespace = /^\s+$/.test(token);
        
        if (isWhitespace) {
            return <span key={idx}>{token}</span>;
        }
        
        // It's a word
        const isSpoken = currentCleanWordIndex < spokenWordsCount;
        const isCurrent = currentCleanWordIndex === spokenWordsCount - 1;
        
        const element = (
            <span 
                key={idx} 
                ref={isCurrent ? activeWordRef : null}
                className={`transition-colors duration-300 ${isSpoken ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-400 dark:text-gray-600'} ${isCurrent ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}`}
            >
                {token}
            </span>
        );
        
        currentCleanWordIndex++;
        return element;
    });
  };

  // Auto-scroll
  useEffect(() => {
    if (activeWordRef.current && isListening) {
        activeWordRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
  }, [spokenWordsCount, isListening]);

  return (
    <div 
        ref={containerRef}
        className="w-full h-full p-8 md:p-12 overflow-y-auto leading-relaxed whitespace-pre-wrap font-serif bg-white dark:bg-black"
        style={{ fontSize: `${fontSize}px` }}
    >
        {renderContent()}
    </div>
  );
};

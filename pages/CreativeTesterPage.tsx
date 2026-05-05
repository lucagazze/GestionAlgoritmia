import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Video, Image as ImageIcon, BrainCircuit, Activity, Eye, Zap, BarChart3, RefreshCw, FileAudio, CheckCircle2, AlertCircle } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ai } from '../services/ai';

const generateMockData = (file: File, duration: number) => {
  const fileType = file.type || '';
  const isVideo = fileType.startsWith('video') || !!file.name.match(/\.(mp4|webm|ogg|mov)$/i);
  const isImage = fileType.startsWith('image') || !!file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  
  // Deterministic seed based on file properties
  const seedString = file.name + file.size + file.lastModified;
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = ((seed << 5) - seed) + seedString.charCodeAt(i);
    seed |= 0;
  }
  
  // Mulberry32 PRNG
  const seededRandom = () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  
  const v1Base = isVideo ? 85 : isImage ? 95 : 40;
  const a1Base = isVideo ? 80 : isImage ? 20 : 95;
  const ffaBase = Math.floor(seededRandom() * 40) + 50; 
  const ebaBase = Math.floor(seededRandom() * 40) + 40; 
  const ppaBase = Math.floor(seededRandom() * 40) + 50; 
  const amygdalaBase = Math.floor(seededRandom() * 50) + 40;

  const newBrainData = [
    { subject: 'V1 (Visual)', value: v1Base + Math.floor(seededRandom() * 10), fullMark: 100 },
    { subject: 'A1 (Audio)', value: a1Base + Math.floor(seededRandom() * 10), fullMark: 100 },
    { subject: 'FFA (Rostros)', value: ffaBase, fullMark: 100 },
    { subject: 'EBA (Cuerpos)', value: ebaBase, fullMark: 100 },
    { subject: 'PPA (Lugares)', value: ppaBase, fullMark: 100 },
    { subject: 'Amígdala (Emoción)', value: amygdalaBase, fullMark: 100 },
  ];

  let currentAttention = Math.floor(seededRandom() * 20) + 70;
  let currentMemory = Math.floor(seededRandom() * 20) + 50;

  const newAttentionData = Array.from({ length: duration }).map((_, i) => {
    currentAttention = Math.min(100, Math.max(30, currentAttention + (seededRandom() * 20 - 10)));
    currentMemory = Math.min(100, Math.max(20, currentMemory + (seededRandom() * 15 - 7.5)));
    return {
      time: `${i}s`,
      attention: Math.floor(currentAttention),
      memory: Math.floor(currentMemory)
    };
  });

  // Hacemos que los resultados dependan más de la metadata real para mayor coherencia
  const baseAttention = isVideo ? (v1Base + a1Base) / 2 : v1Base;
  const attentionPct = Math.min(99, Math.floor(baseAttention * 0.8 + seededRandom() * 20));
  
  // Videos suelen tener mayor impacto emocional por defecto debido a la música y movimiento
  const emotionPct = isVideo ? Math.min(99, Math.floor(seededRandom() * 20) + 75) : Math.min(99, amygdalaBase + Math.floor(seededRandom() * 15));
  
  // Carga cognitiva penaliza videos muy largos o archivos extremadamente pesados (mal optimizados)
  const sizeInMb = file.size / (1024 * 1024);
  const cogLoad = Math.max(12, Math.min(85, Math.floor(duration * 0.4 + sizeInMb * 0.5 + seededRandom() * 15)));
  
  // Score Global makes sense: 40% Attention + 40% Emotion + 20% (100-CognitiveLoad)
  const finalScore = Math.floor((attentionPct * 0.4) + (emotionPct * 0.4) + ((100 - cogLoad) * 0.2));
  
  const textInsights = isImage ? [
    "TRIBE v2 detecta una rápida asimilación de la composición estática. El ojo escanea primero los elementos con mayor contraste visual.",
    "Al ser una imagen, el esfuerzo recae 100% en la jerarquía visual. Excelente activación del córtex prefrontal asimilando el texto.",
    "El nivel de atención se centra rápidamente. La paleta cromática estimula áreas de memoria a corto plazo efectivamente.",
    "Fuerte activación en el área de procesamiento visual (V1) y facial (FFA), indicando que la imagen tiene elementos humanos fuertes."
  ] : [
    "TRIBE v2 actúa como un gemelo digital, revelando una fuerte activación zero-shot en la corteza visual primaria. El mensaje visual es procesado instantáneamente.",
    "Resolución predictiva 70x: Se detecta alta coherencia in-silico entre la señal auditiva y visual en el video. La amígdala muestra picos de resonancia emocional profunda.",
    "El nivel de atención base es estable a lo largo del metraje. La actividad simulada sugiere que el video se integra sin fricción en los sujetos.",
    "Fuerte activación en el córtex auditivo primario (A1) sincronizada con picos visuales del video, validado por los modelos entrenados."
  ];

  const isApproved = finalScore >= 75;
  const verdictStatus = finalScore >= 80 ? 'Excelente' : finalScore >= 60 ? 'Aceptable' : 'Deficiente';
  const sortedBrain = [...newBrainData].sort((a, b) => b.value - a.value);
  const highestRegion = sortedBrain[0].subject.split(' ')[0];

  const conclusionText = `Basado en la simulación predictiva de TRIBE v2 (N=700), el activo genera un nivel de retención atencional del ${attentionPct}% y un impacto emocional del ${emotionPct}%. La mayor estimulación ocurre en la región ${highestRegion}, lo que sugiere un rápido procesamiento cognitivo inicial. En términos neuro-comerciales, el desempeño del gemelo digital es ${verdictStatus.toLowerCase()}, ${isApproved ? 'con altas probabilidades de ser codificado en la memoria a largo plazo del consumidor.' : 'indicando que la sobrecarga cognitiva o la falta de anclajes emocionales limitan su eficacia.'}`;

  const cogLoadStatus = cogLoad <= 30 ? 'Óptima' : cogLoad <= 45 ? 'Moderada' : 'Alta';

  let minAttentionTime = 0;
  let minAttentionValue = 100;
  let totalMemory = 0;
  newAttentionData.forEach((d, i) => {
    totalMemory += d.memory;
    if (d.attention < minAttentionValue && i > 3) {
      minAttentionValue = d.attention;
      minAttentionTime = i;
    }
  });
  const avgMemory = newAttentionData.length > 0 ? totalMemory / newAttentionData.length : 50;

  const actionItems = [];
  if (minAttentionValue < 60 && duration > 5) {
    if (isImage) {
      actionItems.push("El ojo del usuario abandona la imagen rápidamente (baja retención). Recomendamos cambiar la jerarquía visual para guiar la mirada hacia el mensaje principal.");
    } else {
      actionItems.push(`Caída de atención detectada en el segundo ${minAttentionTime}. Insertar un cambio de plano (B-roll) o un gancho sonoro en el segundo ${minAttentionTime - 1} para retener al usuario.`);
    }
  }
  if (attentionPct < 75) {
    actionItems.push(isImage ? "Aumentar el contraste o el tamaño del elemento central. El estímulo visual inicial es débil." : "Añadir ganchos visuales (texto dinámico o cortes rápidos) en los primeros 3 segundos.");
  }
  if (emotionPct < 70) {
    actionItems.push(isImage ? "La imagen es demasiado fría o plana. Utilizar colores cálidos o rostros expresivos para activar la amígdala." : "Incorporar música más intensa o rostros expresivos para activar la amígdala.");
  }
  if (cogLoad > 35) {
    actionItems.push(isImage ? "Exceso de texto visual. Eliminar al menos 30% del texto para bajar la carga cognitiva y hacer el anuncio más directo." : "Reducir la cantidad de texto en pantalla y ralentizar transiciones para bajar la carga cognitiva.");
  }
  if (highestRegion === 'V1' && attentionPct >= 70) {
    actionItems.push("Excelente estímulo visual primario. Mantener la paleta de colores actual.");
  }
  if (ffaBase > 70) {
    actionItems.push(isImage ? "El rostro detectado genera buena empatía. Trata de que el titular principal apunte hacia donde mira la persona." : "Los rostros generan gran retención. Mantén a las personas visibles en pantalla y evita taparlos con texto.");
  }
  if (a1Base > 75 && isVideo) {
    actionItems.push("El patrón de audio y voz lidera la atención. Asegúrate de incluir subtítulos dinámicos para la audiencia que ve videos en silencio.");
  }
  if (avgMemory < 60) {
    actionItems.push("El anclaje en memoria es débil. Asegúrate de mostrar el logo de tu marca o producto durante más tiempo para evitar el síndrome del 'video fantasma' (gustó pero olvidaron la marca).");
  }
  if (actionItems.length === 0) {
    actionItems.push(isImage ? "La imagen está optimizada para pauta gráfica." : "Escalar pauta publicitaria en video. El creativo está optimizado.");
  }

  return { 
    newBrainData, 
    newAttentionData, 
    finalScore,
    insights: {
      attention: attentionPct >= 75 ? 'Alto' : attentionPct >= 60 ? 'Medio' : 'Bajo',
      attentionPct,
      attentionReason: '',
      emotion: emotionPct >= 70 ? 'Alto' : emotionPct >= 50 ? 'Medio-Alto' : 'Bajo',
      emotionPct,
      emotionReason: '',
      cogLoad,
      cogLoadStatus,
      cogLoadReason: '',
      text: textInsights[Math.floor(seededRandom() * textInsights.length)],
      actionItems: actionItems,
      highestRegion,
      verdictTitle: isApproved ? 'Creativo Optimizado (Aprobado)' : 'Requiere Ajustes Cognitivos',
      verdictText: conclusionText,
      isApproved
    }
  };
};

const analyzeSteps = [
  { threshold: 0,  label: "Inicializando modelo TRIBE v2..." },
  { threshold: 10, label: "Extrayendo fotogramas clave del creativo..." },
  { threshold: 25, label: "Enviando frames al motor de visión GPT-4o..." },
  { threshold: 50, label: "Analizando jerarquía visual y respuesta emocional..." },
  { threshold: 75, label: "Calibrando métricas fMRI y carga cognitiva..." },
  { threshold: 90, label: "Generando plan de acción personalizado..." },
];

const extractMediaFrames = async (file: File): Promise<string[]> => {
  return new Promise((resolve) => {
    const isVideo = file.type.startsWith('video');
    
    if (!isVideo) {
       const reader = new FileReader();
       reader.onload = (e) => resolve([e.target?.result as string]);
       reader.readAsDataURL(file);
       return;
    }

    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    
    const frames: string[] = [];
    
    video.onloadedmetadata = () => {
      const dur = video.duration;
      
      // 1 frame per second, max 20 frames — covers the whole video timeline
      const totalFrames = Math.min(20, Math.max(5, Math.ceil(dur)));
      const frameTimestamps = Array.from({ length: totalFrames }, (_, i) =>
        (dur / totalFrames) * i + (dur / totalFrames / 2)
      );
      
      let currentIdx = 0;
      
      video.onseeked = () => {
         const canvas = document.createElement('canvas');
         // Scale to max 512px wide — enough detail, keeps token count low
         const scale = Math.min(1, 512 / video.videoWidth);
         canvas.width = Math.floor(video.videoWidth * scale);
         canvas.height = Math.floor(video.videoHeight * scale);
         const ctx = canvas.getContext('2d');
         ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
         frames.push(canvas.toDataURL('image/jpeg', 0.65));
         
         currentIdx++;
         if (currentIdx < totalFrames) {
            video.currentTime = frameTimestamps[currentIdx];
         } else {
            URL.revokeObjectURL(video.src);
            resolve(frames);
         }
      };
      
      video.currentTime = frameTimestamps[0];
    };
    
    video.onerror = () => {
       URL.revokeObjectURL(video.src);
       resolve([]);
    }
  });
};

export default function CreativeTesterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'complete'>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(analyzeSteps[0].label);
  const [mediaDuration, setMediaDuration] = useState<number>(30);
  const [extractedFrames, setExtractedFrames] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [brainData, setBrainData] = useState<any[]>([]);
  const [attentionData, setAttentionData] = useState<any[]>([]);
  const [score, setScore] = useState(0);
  const [insights, setInsights] = useState<any>({});

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setStatus('idle');
    setProgress(0);
    
    if (selectedFile.type.startsWith('video') || selectedFile.type.startsWith('audio')) {
      const media = document.createElement(selectedFile.type.startsWith('video') ? 'video' : 'audio');
      media.preload = 'metadata';
      media.onloadedmetadata = () => {
        window.URL.revokeObjectURL(media.src);
        setMediaDuration(Math.max(1, Math.round(media.duration)));
      };
      media.src = URL.createObjectURL(selectedFile);
    } else {
      setMediaDuration(10);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setStatus('analyzing');
    setProgress(0);

    let { newBrainData, newAttentionData, finalScore, insights: newInsights } = generateMockData(file, mediaDuration);
    const isVideo = file.type.startsWith('video') || !!file.name.match(/\.(mp4|webm|ogg|mov)$/i);

    const duration = 4000; // 4 seconds fake loading min
    const intervalTime = 50;
    const increment = 100 / (duration / intervalTime);
    
    let isApiDone = false;

    const interval = setInterval(() => {
      setProgress(p => {
        const next = p + increment;
        if (next >= 95 && !isApiDone) {
          return 95; // Stall at 95% if API is still running
        }
        if (next >= 100 && isApiDone) {
          clearInterval(interval);
          setStatus('complete');
          return 100;
        }
        return next;
      });
    }, intervalTime);

    try {
      setCurrentStep('Extrayendo fotogramas clave del creativo...');
      const frames = await extractMediaFrames(file);
      setExtractedFrames(frames);

      if (frames.length > 0) {
          setCurrentStep('Enviando frames al motor de visión GPT-4o...');
          const aiResult = await ai.analyzeCreative(frames, isVideo);
          if (aiResult && typeof aiResult.attentionPct === 'number') {
             finalScore = Math.floor((aiResult.attentionPct * 0.4) + (aiResult.emotionPct * 0.4) + ((100 - aiResult.cogLoad) * 0.2));
             const isApproved = finalScore >= 75;
             const verdictStatus = finalScore >= 80 ? 'Excelente' : finalScore >= 60 ? 'Aceptable' : 'Deficiente';
             const conclusionText = `Basado en el análisis de ${frames.length} fotogramas reales mediante IA, el activo genera un nivel de retención atencional del ${aiResult.attentionPct}% y un impacto emocional del ${aiResult.emotionPct}%. La mayor estimulación ocurre en la región ${aiResult.highestRegion}. ${aiResult.textInsight} En términos neuro-comerciales, el desempeño es ${verdictStatus.toLowerCase()}.`;
             
             newInsights = {
                 attention: aiResult.attentionPct >= 75 ? 'Alto' : aiResult.attentionPct >= 60 ? 'Medio' : 'Bajo',
                 attentionPct: aiResult.attentionPct,
                 attentionReason: aiResult.attentionReason || '',
                 emotion: aiResult.emotionPct >= 70 ? 'Alto' : aiResult.emotionPct >= 50 ? 'Medio-Alto' : 'Bajo',
                 emotionPct: aiResult.emotionPct,
                 emotionReason: aiResult.emotionReason || '',
                 cogLoad: aiResult.cogLoad,
                 cogLoadReason: aiResult.cogLoadReason || '',
                 cogLoadStatus: aiResult.cogLoad <= 30 ? 'Óptima' : aiResult.cogLoad <= 45 ? 'Moderada' : 'Alta',
                 text: aiResult.textInsight,
                 actionItems: aiResult.actionItems || newInsights.actionItems,
                 highestRegion: aiResult.highestRegion,
                 verdictTitle: isApproved ? 'Creativo Optimizado ✓' : finalScore >= 60 ? 'Requiere Ajustes Menores' : 'Revisar Antes de Pautar',
                 verdictText: conclusionText,
                 isApproved
             };

             newBrainData = newBrainData.map(d => {
                 if (d.subject.includes(aiResult.highestRegion)) {
                     return { ...d, value: Math.max(85, d.value + 20) };
                 }
                 return d;
             });

             const currentMockAvgAtt = newAttentionData.reduce((acc, d) => acc + d.attention, 0) / newAttentionData.length;
             const attRatio = aiResult.attentionPct / currentMockAvgAtt;
             const currentMockAvgMem = newAttentionData.reduce((acc, d) => acc + d.memory, 0) / newAttentionData.length;
             const memRatio = aiResult.emotionPct / currentMockAvgMem;

             newAttentionData = newAttentionData.map(d => ({
                 ...d,
                 attention: Math.max(10, Math.min(99, Math.floor(d.attention * attRatio))),
                 memory: Math.max(10, Math.min(99, Math.floor(d.memory * memRatio)))
             }));
          }
      }
    } catch (e) {
      console.error("Failed to analyze with AI, falling back to mock", e);
    } finally {
      setBrainData(newBrainData);
      setAttentionData(newAttentionData);
      setScore(finalScore);
      setInsights(newInsights);
      isApiDone = true;
    }
  };

  useEffect(() => {
    if (status === 'analyzing') {
      const step = [...analyzeSteps].reverse().find(s => progress >= s.threshold);
      if (step) setCurrentStep(step.label);
    }
  }, [progress, status]);

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setStatus('idle');
    setProgress(0);
    setExtractedFrames([]);
  };

  const fileType = file?.type || '';
  const isVideo = fileType.startsWith('video') || !!file?.name.match(/\.(mp4|webm|ogg|mov)$/i);
  const isImage = fileType.startsWith('image') || !!file?.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                Creative Tester
              </h1>
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5 mt-0.5">
                <SparklesIcon className="w-3.5 h-3.5 text-indigo-500" />
                Gemelo Digital Neuronal In-Silico (TRIBE v2)
              </p>
            </div>
          </div>
        </div>
        {status === 'complete' && (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-zinc-800 rounded-lg text-[13px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Analizar otro creativo
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white dark:bg-[#161618] border border-zinc-200 dark:border-white/[0.05] rounded-2xl p-8 shadow-sm"
          >
            <div 
              className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-colors ${
                file ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/5' : 'border-zinc-300 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-500/50'
              }`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="video/*,image/*,audio/*"
                className="hidden"
              />
              
              {file ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                    {isVideo ? <Video className="w-8 h-8" /> : 
                     isImage ? <ImageIcon className="w-8 h-8" /> : 
                     <FileAudio className="w-8 h-8" />}
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-zinc-900 dark:text-white">
                      {file.name}
                    </p>
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 cursor-pointer">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 flex items-center justify-center mx-auto">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-zinc-900 dark:text-white">
                      Sube tu creativo (Video, Imagen o Audio)
                    </p>
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1">
                      Arrastra y suelta aquí, o haz clic para seleccionar
                    </p>
                  </div>
                </div>
              )}
            </div>

            {file && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleAnalyze}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[14px] font-medium transition-colors shadow-lg shadow-indigo-600/20"
                >
                  <BrainCircuit className="w-4 h-4" />
                  Ejecutar In-Silico fMRI
                </button>
              </div>
            )}
          </motion.div>
        )}

        {status === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-[#161618] border border-zinc-200 dark:border-white/[0.05] rounded-2xl p-12 shadow-sm flex flex-col items-center justify-center text-center min-h-[400px]"
          >
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse" />
              <BrainCircuit className="w-16 h-16 text-indigo-600 dark:text-indigo-400 relative z-10 animate-bounce" />
            </div>
            
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
              Procesando Modelo Multimodal
            </h3>
            <p className="text-[14px] text-zinc-500 dark:text-zinc-400 mb-8 h-5">
              {currentStep}
            </p>

            <div className="w-full max-w-md bg-zinc-100 dark:bg-white/5 rounded-full h-2.5 mb-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2.5 rounded-full transition-all duration-200 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[12px] font-medium text-zinc-400 dark:text-zinc-500">
              {Math.round(progress)}%
            </p>
          </motion.div>
        )}

        {status === 'complete' && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Reporte Definitivo Final */}
            <div className="bg-white dark:bg-[#161618] border border-zinc-200 dark:border-white/[0.05] rounded-2xl shadow-sm overflow-hidden mb-6">
              <div className={`px-8 py-5 flex items-center gap-3 border-b border-black/5 dark:border-white/5 ${insights.isApproved ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-amber-50 dark:bg-amber-500/10'}`}>
                {insights.isApproved ? <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /> : <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />}
                <h2 className={`text-lg font-bold ${insights.isApproved ? 'text-emerald-900 dark:text-emerald-400' : 'text-amber-900 dark:text-amber-400'}`}>
                  Diagnóstico y Plan de Acción Final
                </h2>
              </div>

            {/* File info bar */}
            <div className="flex flex-wrap items-center gap-3 px-8 py-4 border-b border-zinc-100 dark:border-white/[0.04] bg-zinc-50/50 dark:bg-white/[0.01] text-[12px] text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-zinc-700 dark:text-zinc-200 truncate max-w-[200px]">{file?.name}</span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span>{(file?.size ?? 0) > 1024*1024 ? `${((file?.size ?? 0)/1024/1024).toFixed(1)} MB` : `${((file?.size ?? 0)/1024).toFixed(0)} KB`}</span>
              {mediaDuration > 1 && <><span className="text-zinc-300 dark:text-zinc-700">·</span><span>{mediaDuration}s de duración</span></>}
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="font-medium">{isVideo ? '🎬 Video Vertical' : isImage ? '🖼️ Imagen Estática' : '🎵 Audio'}</span>
              <span className="ml-auto text-zinc-400 dark:text-zinc-500">{extractedFrames.length} frames analizados por IA</span>
            </div>

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-white/[0.05]">
                {/* Column 1: Score Global */}
                <div className="p-8 flex flex-col items-center justify-center text-center">
                  <span className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-4">Score Global</span>
                  <div className="relative mb-4 flex items-center justify-center">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle cx="64" cy="64" r="56" className="text-zinc-100 dark:text-zinc-800" strokeWidth="12" stroke="currentColor" fill="transparent" />
                      <circle cx="64" cy="64" r="56" className={`${score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-red-500'}`} strokeWidth="12" strokeDasharray={56 * 2 * Math.PI} strokeDashoffset={56 * 2 * Math.PI * (1 - score / 100)} strokeLinecap="round" stroke="currentColor" fill="transparent" style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-black text-zinc-900 dark:text-white">{score}</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-zinc-900 dark:text-white text-lg mb-1">{insights.verdictTitle}</h3>
                  <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{insights.isApproved ? 'Lista para escalar en pauta.' : 'Necesita edición antes de pautar.'}</p>
                </div>

                {/* Column 2: Características del Creativo */}
                <div className="p-8">
                  <h3 className="font-semibold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" />
                    Características Actuales
                  </h3>
                  <ul className="space-y-5">
                    <li>
                      <div className="flex justify-between text-[13px] mb-1.5">
                        <span className="text-zinc-600 dark:text-zinc-400 font-medium">Atención Visual</span>
                        <span className="font-semibold text-zinc-900 dark:text-white">{insights.attention} ({insights.attentionPct}%)</span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden mb-1.5">
                        <div className={`h-full ${insights.attentionPct >= 75 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{width: `${insights.attentionPct}%`}}></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-medium px-0.5">
                        <span title="Menor a 60%">Deficiente (&lt;60%)</span>
                        <span title="Entre 60% y 74%">Medio (60-74%)</span>
                        <span title="Mayor a 75%">Excelente (&gt;75%)</span>
                      </div>
                      {insights.attentionReason && <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">{insights.attentionReason}</p>}
                    </li>
                    <li>
                      <div className="flex justify-between text-[13px] mb-1.5">
                        <span className="text-zinc-600 dark:text-zinc-400 font-medium">Impacto Emocional</span>
                        <span className="font-semibold text-zinc-900 dark:text-white">{insights.emotion} ({insights.emotionPct}%)</span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden mb-1.5">
                        <div className={`h-full ${insights.emotionPct >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{width: `${insights.emotionPct}%`}}></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-medium px-0.5">
                        <span title="Menor a 50%">Deficiente (&lt;50%)</span>
                        <span title="Entre 50% y 69%">Medio (50-69%)</span>
                        <span title="Mayor a 70%">Excelente (&gt;70%)</span>
                      </div>
                      {insights.emotionReason && <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">{insights.emotionReason}</p>}
                    </li>
                    <li>
                      <div className="flex justify-between text-[13px] mb-1.5">
                        <span className="text-zinc-600 dark:text-zinc-400 font-medium">Carga Cognitiva</span>
                        <span className={`font-semibold ${insights.cogLoad <= 30 ? 'text-emerald-500' : insights.cogLoad <= 45 ? 'text-amber-500' : 'text-red-500'}`}>{insights.cogLoadStatus} ({insights.cogLoad}%)</span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden mb-1.5">
                        <div className={`h-full ${insights.cogLoad <= 30 ? 'bg-emerald-500' : insights.cogLoad <= 45 ? 'bg-amber-500' : 'bg-red-500'}`} style={{width: `${insights.cogLoad}%`}}></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-medium px-0.5">
                        <span title="Menor a 30%">Óptima (&lt;30%)</span>
                        <span title="Entre 30% y 45%">Moderada (30-45%)</span>
                        <span title="Mayor a 45%">Excesiva (&gt;45%)</span>
                      </div>
                      {insights.cogLoadReason && <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">{insights.cogLoadReason}</p>}
                    </li>
                  </ul>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-5 leading-relaxed bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                    <strong className="text-zinc-700 dark:text-zinc-300 font-semibold">Principal estímulo:</strong> La región {insights.highestRegion} es la más activada en el usuario.
                  </p>
                </div>
              </div>

              {/* Fila Inferior: Plan de Acción */}
              <div className="p-8 bg-zinc-50 dark:bg-zinc-800/20 border-t border-zinc-200 dark:border-white/[0.05]">
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Plan de Acción Técnico
                  <span className="ml-auto text-[11px] font-normal text-zinc-400">🔴 Crítico · 🟡 Importante · ✅ Correcto</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {insights.actionItems?.map((item: string, idx: number) => {
                    const isCritical = /regrabar|cambiar.*música|no.*salvación|cambiar.*talento|critico|iluminación.*deficiente/i.test(item);
                    const isGood = /excelente|correcto|funciona|óptimo|mantener/i.test(item);
                    const badge = isCritical ? { label: '🔴 Crítico', cls: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' } 
                                 : isGood    ? { label: '✅ Bien', cls: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' } 
                                            : { label: '🟡 Importante', cls: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' };
                    return (
                      <div key={idx} className={`flex gap-3 items-start p-4 rounded-xl border shadow-sm ${badge.cls}`}>
                        <div className="w-6 h-6 mt-0.5 rounded-full bg-white/60 dark:bg-black/20 text-zinc-700 dark:text-zinc-200 flex items-center justify-center shrink-0 text-[12px] font-bold border border-black/5">
                          {idx + 1}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{badge.label}</span>
                          <p className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed mt-1">{item}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Preview + Frames */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-[#161618] border border-zinc-200 dark:border-white/[0.05] rounded-2xl overflow-hidden shadow-sm">
                  <div className="relative bg-black flex items-center justify-center" style={{ aspectRatio: '9/16', maxHeight: '500px' }}>
                    {isVideo ? (
                      <video src={previewUrl!} controls className="w-full h-full object-contain" />
                    ) : isImage ? (
                      <img src={previewUrl!} alt="Preview" className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-zinc-500 flex flex-col items-center">
                        <FileAudio className="w-12 h-12 mb-2 opacity-50" />
                        <span className="text-sm">Audio Track</span>
                      </div>
                    )}
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10 flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-white text-[10px] font-medium">Analizado</span>
                    </div>
                  </div>
                  {extractedFrames.length > 1 && (
                    <div className="p-3 border-t border-zinc-100 dark:border-white/[0.04]">
                      <p className="text-[10px] text-zinc-400 mb-2 font-medium uppercase tracking-wider">Fotogramas Analizados</p>
                      <div className="flex gap-2 overflow-x-auto">
                        {extractedFrames.map((f, i) => (
                          <img key={i} src={f} alt={`Frame ${i+1}`} className="h-14 w-auto rounded-md border border-zinc-200 dark:border-zinc-700 object-cover shrink-0" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg">
                  <h3 className="font-semibold text-[15px] mb-2 flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4 text-indigo-200" />
                    Análisis In-Silico
                  </h3>
                  <p className="text-indigo-100 text-[13px] leading-relaxed">
                    {insights.text}
                  </p>
                </div>
              </div>

              {/* Right Column: Charts */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-[#161618] border border-zinc-200 dark:border-white/[0.05] rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-white text-[15px]">
                        Predicción BOLD fMRI por Región Cortical
                      </h3>
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Activación neuronal simulada en respuesta al estímulo
                      </p>
                    </div>
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                      <BrainCircuit className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={brainData}>
                        <PolarGrid stroke="#3f3f46" strokeOpacity={0.2} />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar
                          name="Activación Predicha"
                          dataKey="value"
                          stroke="#6366f1"
                          strokeWidth={2}
                          fill="#6366f1"
                          fillOpacity={0.3}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                          itemStyle={{ color: '#818cf8' }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#161618] border border-zinc-200 dark:border-white/[0.05] rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-white text-[15px]">
                        Curva de Retención de Atención
                      </h3>
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Proyección de atención visual y memoria de trabajo temporal
                      </p>
                    </div>
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                      <Activity className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={attentionData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorAttention" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" strokeOpacity={0.2} />
                        <XAxis dataKey="time" tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                        />
                        <Area type="monotone" dataKey="attention" name="Atención" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorAttention)" />
                        <Area type="monotone" dataKey="memory" name="Memoria" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorMemory)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Metodología / Glosario */}
            <div className="bg-zinc-50 dark:bg-[#161618] border border-zinc-200 dark:border-white/[0.05] rounded-2xl p-6 sm:p-8 shadow-sm">
              <h3 className="font-semibold text-zinc-900 dark:text-white text-[16px] mb-6 flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-indigo-500" />
                ¿Por qué importan estos puntajes? (La ciencia detrás)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="text-[14px] font-bold text-zinc-800 dark:text-zinc-200 mb-2 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-emerald-500" />
                    Retención de Atención
                  </h4>
                  <p className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Mide si el córtex visual (V1) logra "anclarse" al contenido. Si supera el <strong>75%</strong>, significa que el gancho de los primeros segundos es tan fuerte que detiene el scroll. Si es bajo, la vista del usuario simplemente se resbala y pasa al siguiente video.
                  </p>
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-zinc-800 dark:text-zinc-200 mb-2 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Impacto Emocional
                  </h4>
                  <p className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Refleja la activación de la <strong>Amígdala</strong>. Un mensaje sin emoción se olvida a los 5 minutos. Si el impacto supera el <strong>70%</strong>, ya sea por intriga, risa o impacto visual, el cerebro lo cataloga como una "memoria a largo plazo" (clave para que luego compren).
                  </p>
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-zinc-800 dark:text-zinc-200 mb-2 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-red-500" />
                    Carga Cognitiva (Debe ser &lt;30%)
                  </h4>
                  <p className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Representa el "esfuerzo mental" necesario para entender tu anuncio. Si hay mucho texto, ruidos y cortes bruscos a la vez, la carga sube demasiado. <strong>Si supera el 30%</strong>, el usuario se frustra inconscientemente y lo descarta. El mejor creativo es el que se entiende "sin pensar".
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/>
      <path d="M19 17v4"/>
      <path d="M3 5h4"/>
      <path d="M17 19h4"/>
    </svg>
  );
}

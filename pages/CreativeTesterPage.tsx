import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Video, Image as ImageIcon, BrainCircuit, Activity, Eye, Zap, BarChart3, RefreshCw, FileAudio, CheckCircle2, AlertCircle } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const generateMockData = (fileType: string) => {
  const isVideo = fileType.startsWith('video');
  const isImage = fileType.startsWith('image');
  
  const v1Base = isVideo ? 85 : isImage ? 95 : 40;
  const a1Base = isVideo ? 80 : isImage ? 20 : 95;
  const ffaBase = Math.floor(Math.random() * 40) + 50; 
  const ebaBase = Math.floor(Math.random() * 40) + 40; 
  const ppaBase = Math.floor(Math.random() * 40) + 50; 
  const amygdalaBase = Math.floor(Math.random() * 50) + 40;

  const newBrainData = [
    { subject: 'V1 (Visual)', value: v1Base + Math.floor(Math.random() * 10), fullMark: 100 },
    { subject: 'A1 (Audio)', value: a1Base + Math.floor(Math.random() * 10), fullMark: 100 },
    { subject: 'FFA (Rostros)', value: ffaBase, fullMark: 100 },
    { subject: 'EBA (Cuerpos)', value: ebaBase, fullMark: 100 },
    { subject: 'PPA (Lugares)', value: ppaBase, fullMark: 100 },
    { subject: 'Amígdala (Emoción)', value: amygdalaBase, fullMark: 100 },
  ];

  const duration = isImage ? 10 : 30;
  let currentAttention = Math.floor(Math.random() * 20) + 70;
  let currentMemory = Math.floor(Math.random() * 20) + 50;

  const newAttentionData = Array.from({ length: duration }).map((_, i) => {
    currentAttention = Math.min(100, Math.max(30, currentAttention + (Math.random() * 20 - 10)));
    currentMemory = Math.min(100, Math.max(20, currentMemory + (Math.random() * 15 - 7.5)));
    return {
      time: `${i}s`,
      attention: Math.floor(currentAttention),
      memory: Math.floor(currentMemory)
    };
  });

  const finalScore = Math.min(99, Math.max(45, Math.floor((v1Base + a1Base + ffaBase + amygdalaBase) / 4) + Math.floor(Math.random() * 10)));
  
  const attentionPct = Math.floor(Math.random() * 30) + 65;
  const emotionPct = Math.floor(Math.random() * 40) + 50;
  
  const textInsights = [
    "TRIBE v2 actúa como un gemelo digital, revelando una fuerte activación zero-shot en la corteza visual primaria. El mensaje visual es procesado instantáneamente.",
    "Resolución predictiva 70x: Se detecta alta coherencia in-silico entre la señal auditiva y visual. La amígdala muestra picos de resonancia emocional profunda.",
    "El nivel de atención base es estable. La actividad simulada de la red de modo por defecto sugiere que el mensaje se integra sin fricción en los sujetos.",
    "Fuerte activación en el córtex auditivo primario (A1) sincronizada con picos visuales, validado por los modelos entrenados en más de 700 voluntarios."
  ];

  const recommendations = [
    "El pico emocional decae en la segunda mitad. Considerar introducir un cambio de ritmo visual o musical para mantener el engagement.",
    "La atención visual es excelente. Sugerimos agregar un Call To Action (CTA) justo en el pico de mayor activación de la amígdala.",
    "Para mejorar la retención, asegúrate de que el logo o mensaje principal aparezca durante los primeros 5 segundos donde la atención está en su máximo.",
    "El audio lidera la atención. Refuerza los efectos sonoros en las transiciones visuales clave para maximizar el impacto."
  ];

  const isApproved = finalScore >= 75;
  const verdictStatus = finalScore >= 80 ? 'Excelente' : finalScore >= 60 ? 'Aceptable' : 'Deficiente';
  const sortedBrain = [...newBrainData].sort((a, b) => b.value - a.value);
  const highestRegion = sortedBrain[0].subject.split(' ')[0];

  const conclusionText = `Basado en la simulación predictiva de TRIBE v2 (N=700), el activo genera un nivel de retención atencional del ${attentionPct}% y un impacto emocional del ${emotionPct}%. La mayor estimulación ocurre en la región ${highestRegion}, lo que sugiere un rápido procesamiento cognitivo inicial. En términos neuro-comerciales, el desempeño del gemelo digital es ${verdictStatus.toLowerCase()}, ${isApproved ? 'con altas probabilidades de ser codificado en la memoria a largo plazo del consumidor.' : 'indicando que la sobrecarga cognitiva o la falta de anclajes emocionales limitan su eficacia.'}`;

  const cogLoad = Math.floor((100 - attentionPct) * 0.5 + (100 - emotionPct) * 0.5);
  const cogLoadStatus = cogLoad <= 30 ? 'Óptima' : cogLoad <= 45 ? 'Moderada' : 'Alta';

  const actionItems = [];
  if (attentionPct < 75) {
    actionItems.push("Añadir ganchos visuales (texto dinámico o cortes rápidos) en los primeros 3 segundos.");
  }
  if (emotionPct < 70) {
    actionItems.push("Incorporar música más intensa o rostros expresivos para activar la amígdala.");
  }
  if (cogLoad > 35) {
    actionItems.push("Reducir la cantidad de texto en pantalla y ralentizar transiciones para bajar la carga cognitiva.");
  }
  if (highestRegion === 'V1' && attentionPct >= 70) {
    actionItems.push("Excelente estímulo visual. Mantener la paleta de colores actual.");
  }
  if (actionItems.length === 0) {
    actionItems.push("Escalar pauta publicitaria. El creativo está optimizado.");
  }

  return { 
    newBrainData, 
    newAttentionData, 
    finalScore,
    insights: {
      attention: attentionPct >= 75 ? 'Alto' : attentionPct >= 60 ? 'Medio' : 'Bajo',
      attentionPct,
      emotion: emotionPct >= 70 ? 'Alto' : emotionPct >= 50 ? 'Medio-Alto' : 'Bajo',
      emotionPct,
      cogLoad,
      cogLoadStatus,
      text: textInsights[Math.floor(Math.random() * textInsights.length)],
      actionItems: actionItems.slice(0, 3),
      highestRegion,
      verdictTitle: isApproved ? 'Creativo Optimizado (Aprobado)' : 'Requiere Ajustes Cognitivos',
      verdictText: conclusionText,
      isApproved
    }
  };
};

const analyzeSteps = [
  { threshold: 0, label: "Inicializando modelo TRIBE v2..." },
  { threshold: 15, label: "Extrayendo características visuales (V-JEPA)..." },
  { threshold: 35, label: "Procesando componentes de audio (Wav2Vec-BERT)..." },
  { threshold: 55, label: "Analizando semántica de texto (LLaMA)..." },
  { threshold: 75, label: "Prediciendo respuestas BOLD fMRI en el córtex..." },
  { threshold: 90, label: "Generando métricas de neuromarketing..." },
];

export default function CreativeTesterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'complete'>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(analyzeSteps[0].label);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [brainData, setBrainData] = useState<any[]>([]);
  const [attentionData, setAttentionData] = useState<any[]>([]);
  const [score, setScore] = useState(0);
  const [insights, setInsights] = useState<any>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setStatus('idle');
      setProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setStatus('idle');
      setProgress(0);
    }
  };

  const handleAnalyze = () => {
    if (!file) return;
    setStatus('analyzing');
    setProgress(0);

    const { newBrainData, newAttentionData, finalScore, insights: newInsights } = generateMockData(file.type);
    setBrainData(newBrainData);
    setAttentionData(newAttentionData);
    setScore(finalScore);
    setInsights(newInsights);

    const duration = 4000; // 4 seconds fake loading
    const intervalTime = 50;
    const increment = 100 / (duration / intervalTime);

    const interval = setInterval(() => {
      setProgress(p => {
        const next = p + increment;
        if (next >= 100) {
          clearInterval(interval);
          setStatus('complete');
          return 100;
        }
        return next;
      });
    }, intervalTime);
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

              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-white/[0.05]">
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
                    </li>
                  </ul>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-5 leading-relaxed bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                    <strong className="text-zinc-700 dark:text-zinc-300 font-semibold">Principal estímulo:</strong> La región {insights.highestRegion} es la más activada en el usuario.
                  </p>
                </div>

                {/* Column 3: Lo que deberías hacer */}
                <div className="p-8 bg-zinc-50 dark:bg-zinc-800/20">
                  <h3 className="font-semibold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Lo que debes hacer
                  </h3>
                  <div className="space-y-3">
                    {insights.actionItems?.map((item: string, idx: number) => (
                      <div key={idx} className="flex gap-3 items-start bg-white dark:bg-[#161618] p-3.5 rounded-xl border border-zinc-200 dark:border-white/[0.05] shadow-sm">
                        <div className="w-5 h-5 mt-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 text-[11px] font-bold">
                          {idx + 1}
                        </div>
                        <p className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Preview & Summary */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-[#161618] border border-zinc-200 dark:border-white/[0.05] rounded-2xl overflow-hidden shadow-sm">
                  <div className="aspect-video bg-black flex items-center justify-center relative">
                    {isVideo ? (
                      <video src={previewUrl!} controls className="w-full h-full object-cover" />
                    ) : isImage ? (
                      <img src={previewUrl!} alt="Preview" className="w-full h-full object-cover" />
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

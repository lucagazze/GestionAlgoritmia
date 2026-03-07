import React, { useState, useRef } from 'react';
import { Sparkles, X, Mic, MicOff, Loader2, Send } from 'lucide-react';
import { ai } from '../../services/ai';
import { db } from '../../services/db';
import { useToast } from '../Toast';
import { MarketingProposalData } from '../../services/pdfGenerator'; // Re-using this type for now as the AI prompt returns it

const inputCls = "w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-zinc-900 dark:text-white";
const textareaCls = inputCls + " resize-none";

export const AIFillModal: React.FC<{
  onClose: () => void;
  onFill: (data: Partial<MarketingProposalData>) => void;
  clientId?: string;
}> = ({ onClose, onFill, clientId }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [savingToClient, setSavingToClient] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { showToast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          setProcessing(true);
          const transcribed = await ai.transcribe({ mimeType: 'audio/webm', data: base64 });
          if (transcribed) {
            setText(prev => prev ? prev + ' ' + transcribed : transcribed);
            showToast('🎤 Transcripción exitosa', 'success');
          } else {
            showToast('No se pudo transcribir el audio', 'error');
          }
          setProcessing(false);
        };
        reader.readAsDataURL(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch {
      showToast('No se pudo acceder al micrófono', 'error');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleProcess = async () => {
    if (!text.trim()) { showToast('Escribí o dictá algo primero', 'error'); return; }
    setProcessing(true);
    try {
      const result = await ai.fillProposalWithAI(text);
      if (!result) { showToast('Error al procesar con IA', 'error'); return; }

      const cleaned: Partial<MarketingProposalData> = {};
      for (const [k, v] of Object.entries(result)) {
        if (v !== null && v !== undefined) {
          if (Array.isArray(v) && k !== 'plans' && k !== 'scenarios') {
            (cleaned as any)[k] = v.join(', ');
          } else {
            (cleaned as any)[k] = v;
          }
        }
      }

      // Save relevant fields to client profile if clientId is provided
      if (clientId && Object.keys(cleaned).length > 0) {
        setSavingToClient(true);
        try {
          const clientUpdate: Record<string, any> = {};
          if (cleaned.targetAudience) clientUpdate.targetAudience = cleaned.targetAudience;
          if (cleaned.proposalObjective) clientUpdate.contextObjectives = cleaned.proposalObjective;
          if (cleaned.painPoint) clientUpdate.contextProblem = cleaned.painPoint;
          if (cleaned.positioning) clientUpdate.growthStrategy = cleaned.positioning;
          if (cleaned.clientIndustry) clientUpdate.industry = cleaned.clientIndustry;
          if (cleaned.clientLocation) clientUpdate.location = cleaned.clientLocation;
          if (cleaned.clientWebsite) clientUpdate.proposalUrl = cleaned.clientWebsite;
          if (cleaned.brandColor) clientUpdate.brandColors = [cleaned.brandColor];
          
          // Guardar los nuevos campos extraídos!
          if (cleaned.dailyAdBudget) clientUpdate.dailyAdBudget = cleaned.dailyAdBudget;
          if (cleaned.platforms) clientUpdate.platforms = cleaned.platforms;
          if (cleaned.avgTicket) clientUpdate.avgTicket = cleaned.avgTicket;
          if (cleaned.clientCompetitors) clientUpdate.competitors = cleaned.clientCompetitors;

          if (Object.keys(clientUpdate).length > 0) {
            await db.projects.update(clientId, clientUpdate);
            showToast('💾 Información guardada en el perfil del cliente', 'success');
          }
        } catch (e) {
          console.error('Error saving to client:', e);
          showToast('No se pudo guardar en el cliente', 'error');
        } finally {
          setSavingToClient(false);
        }
      }

      onFill(cleaned);
      onClose();
      showToast(`✅ ${Object.keys(cleaned).length} campos completados por la IA`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Error al procesar', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Completar con IA</h2>
                <p className="text-indigo-200 text-sm">Contame sobre el cliente y qué se le va a ofrecer — la IA hará el resto</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={processing}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/30'
                : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
              }`}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {isRecording ? 'Detener dictado' : 'Dictar por voz'}
            </button>
            {isRecording && (
              <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                Grabando...
              </div>
            )}
            {processing && !isRecording && (
              <div className="flex items-center gap-2 text-indigo-600 text-sm font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                Transcribiendo...
              </div>
            )}
          </div>

          <div className="relative">
            <textarea
              className={textareaCls + " min-h-[220px]"}
              placeholder={`Contame todo lo que sabés del cliente y lo que le vas a ofrecer. Por ejemplo:

"El cliente se llama Pampita Moda, vende ropa femenina en Buenos Aires. Tiene Instagram con 5k seguidores. Su ticket promedio es $50. Le voy a ofrecer Meta Ads por $400/mes, incluye gestión de campañas, 5 creatividades por mes y reporte semanal. El presupuesto de pauta es $15 por día. Su diferencial es ropa exclusiva con diseños propios..."`}
              value={text}
              onChange={e => setText(e.target.value)}
            />
            {text && (
              <button onClick={() => setText('')} className="absolute top-3 right-3 w-6 h-6 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <p className="text-xs text-zinc-400">
            💡 Podés mezclar voz y texto. Cuanto más info des, más campos se completan mágicamente.
            {clientId && <span className="ml-1 text-indigo-500 font-semibold">Al completar, la información se guardará en el perfil del cliente.</span>}
          </p>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold py-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm">
              Cancelar
            </button>
            <button
              onClick={handleProcess}
              disabled={processing || savingToClient || !text.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 text-sm active:scale-95"
            >
              {(processing || savingToClient) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {processing ? 'Analizando...' : savingToClient ? 'Guardando...' : 'Completar formulario'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

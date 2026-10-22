import {useEffect,useRef,useState} from 'react';
import {Mic,MicOff,Play,Square,Volume2} from 'lucide-react';
export function VoiceDiagnostics(){
  const [state,setState]=useState<'idle'|'recording'|'ready'|'error'>('idle');
  const [error,setError]=useState('');
  const [audioUrl,setAudioUrl]=useState('');
  const recorder=useRef<MediaRecorder|null>(null);
  const activeStream=useRef<MediaStream|null>(null);
  const previousUrl=useRef<string|null>(null);
  const cleanup=()=>{
    if(recorder.current?.state==='recording')recorder.current.stop();
    activeStream.current?.getTracks().forEach(t=>t.stop());
    activeStream.current=null;
  };
  useEffect(()=>()=>{cleanup();if(previousUrl.current)URL.revokeObjectURL(previousUrl.current);},[]);
  const start=async()=>{
    setError('');
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
      setError('Microphone recording is unavailable on this device.');setState('error');return;
    }
    try{
      cleanup();
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      activeStream.current=stream;
      const format=['audio/webm;codecs=opus','audio/webm'].find(x=>MediaRecorder.isTypeSupported(x))||'';
      const m=new MediaRecorder(stream,format?{mimeType:format}:undefined);
      recorder.current=m;
      const chunks:BlobPart[]=[];
      m.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
      m.onstop=()=>{
        stream.getTracks().forEach(t=>t.stop());
        activeStream.current=null;
        if(chunks.length){
          if(previousUrl.current)URL.revokeObjectURL(previousUrl.current);
          const next=URL.createObjectURL(new Blob(chunks,{type:m.mimeType||'audio/webm'}));
          previousUrl.current=next;setAudioUrl(next);setState('ready');
        }else setState('idle');
      };
      m.onerror=()=>{setError('Recording stopped unexpectedly.');setState('error');cleanup();};
      m.start();setState('recording');
    }catch(e){setError(e instanceof Error?e.message:'Microphone permission denied.');setState('error');cleanup();}
  };
  const stop=()=>{if(recorder.current?.state==='recording')recorder.current.stop();};
  return <div className="voice-diagnostics">
    <div className="voice-diagnostics-heading"><Volume2 size={18}/><div>
      <strong>Microphone check</strong>
      <p>Record and play back a private local sample to verify your Windows microphone.</p>
    </div></div>
    <div className="voice-diagnostics-actions">
      {state==='recording'?<button className="button button-primary" onClick={stop}><Square size={16}/> Stop test</button>:
        <button className="button button-subtle" onClick={()=>void start()}>
          {state==='error'?<MicOff size={16}/>:<Mic size={16}/>} Test microphone</button>}
      {state==='ready'&&audioUrl&&<audio src={audioUrl} controls preload="metadata" aria-label="Recorded microphone test"/>}
    </div>
    {state==='recording'&&<p className="voice-diagnostics-recording">Microphone active · sample stays on this device</p>}
    {error&&<p className="voice-diagnostics-error" role="alert">{error}</p>}
    <p className="tiny muted">Voice calls require a separate, secure peer connection and signaling service. This microphone test does not start a call or transmit your audio.</p>
  </div>;
}
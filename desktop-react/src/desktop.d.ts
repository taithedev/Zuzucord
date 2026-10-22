export {};
declare global {
  type UpdatePhase = 'idle'|'checking'|'downloading'|'ready'|'current'|'error'|'unavailable';
  interface UpdateState { phase:UpdatePhase; version:string; percent:number; message:string; }
  interface Window {
    zuzuDesktop?: {
      secureGet(key: string): Promise<string | null>;
      secureSet(key: string, value: string): Promise<boolean>;
      secureRemove(key: string): Promise<void>;
      windowAction(action: 'minimize' | 'maximize' | 'close'): Promise<void>;
      version(): Promise<string>;
      getStartup():Promise<{available:boolean;enabled:boolean}>;
      setStartup(enabled:boolean):Promise<{available:boolean;enabled:boolean}>;
      checkNetwork():Promise<{checkedAt:string;targets:Record<string,{
        reachable:boolean;httpStatus?:number;latencyMs:number|null;error?:string
      }>;}>;
      openOfficialLink(id:'releases'|'docs'):Promise<boolean>;
      checkUpdates(): Promise<UpdateState>;
      updateState(): Promise<UpdateState>;
      restartToUpdate(): Promise<{ok:boolean}>;
      onUpdateStatus(callback:(state:UpdateState)=>void):()=>void;
    };
  }
}

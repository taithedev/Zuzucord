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
      checkUpdates(): Promise<UpdateState>;
      updateState(): Promise<UpdateState>;
      restartToUpdate(): Promise<{ok:boolean}>;
      onUpdateStatus(callback:(state:UpdateState)=>void):()=>void;
    };
  }
}

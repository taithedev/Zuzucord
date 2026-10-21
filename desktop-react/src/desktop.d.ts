export {};
declare global {
  interface Window {
    zuzuDesktop?: {
      secureGet(key: string): Promise<string | null>;
      secureSet(key: string, value: string): Promise<boolean>;
      secureRemove(key: string): Promise<void>;
      windowAction(action: 'minimize' | 'maximize' | 'close'): Promise<void>;
      version(): Promise<string>;
      checkUpdates(): Promise<{tag:string;filename:string;downloadUrl:string;sha256:string|null;notes:string}|null>;
      downloadUpdate(release:{tag:string;filename:string;downloadUrl:string}): Promise<{name:string;path:string;sha256:string;verified:boolean;note:string}>;
      onUpdateAvailable(callback:(release:{tag:string;filename:string;downloadUrl:string;sha256:string|null;notes:string})=>void):()=>void;
    };
  }
}

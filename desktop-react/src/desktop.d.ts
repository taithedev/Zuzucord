export {};
declare global {
  interface Window {
    zuzuDesktop?: {
      secureGet(key: string): Promise<string | null>;
      secureSet(key: string, value: string): Promise<boolean>;
      secureRemove(key: string): Promise<void>;
      windowAction(action: 'minimize' | 'maximize' | 'close'): Promise<void>;
      version(): Promise<string>;
    };
  }
}

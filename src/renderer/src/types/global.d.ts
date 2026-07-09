import type { JarvisBridge } from '../../../shared/platform/ipc';

declare global {
  interface Window {
    readonly jarvis: JarvisBridge;
  }
}

export {};

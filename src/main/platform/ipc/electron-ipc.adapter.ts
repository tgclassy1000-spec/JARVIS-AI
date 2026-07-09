import { ipcMain, type IpcMainInvokeEvent } from 'electron';

import type { IpcMainAdapter, IpcListener } from './types';

export class ElectronIpcAdapter implements IpcMainAdapter {
  public handle(channel: string, listener: IpcListener): void {
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, payload: unknown) =>
      listener(
        {
          senderUrl: event.senderFrame?.url ?? event.sender.getURL(),
          send: (eventChannel, eventPayload) => event.sender.send(eventChannel, eventPayload),
        },
        payload,
      ),
    );
  }

  public removeHandler(channel: string): void {
    ipcMain.removeHandler(channel);
  }
}

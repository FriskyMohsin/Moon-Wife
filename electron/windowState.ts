import { app, Rectangle } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

const DEFAULT_STATE: WindowState = {
  width: 1440,
  height: 900,
  isMaximized: false,
};

export class WindowStateManager {
  private stateFilePath: string;
  private state: WindowState;

  constructor(windowName: string = 'main-window') {
    try {
      const userDataDir = app.getPath('userData');
      this.stateFilePath = path.join(userDataDir, `${windowName}-state.json`);
    } catch {
      this.stateFilePath = path.join(process.cwd(), '.window-state.json');
    }
    this.state = this.loadState();
  }

  private loadState(): WindowState {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const data = fs.readFileSync(this.stateFilePath, 'utf8');
        return { ...DEFAULT_STATE, ...JSON.parse(data) };
      }
    } catch (err) {
      console.warn('[WindowStateManager] Could not load saved window state:', err);
    }
    return { ...DEFAULT_STATE };
  }

  public getState(): WindowState {
    return this.state;
  }

  public saveState(bounds: Rectangle, isMaximized: boolean): void {
    try {
      this.state = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized,
      };
      fs.writeFileSync(this.stateFilePath, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.warn('[WindowStateManager] Could not save window state:', err);
    }
  }
}

import { isPlatformBrowser } from '@angular/common';
import {
  Directive,
  ElementRef,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  Injectable,
  NgModule,
  Renderer2,
  Inject,
  PLATFORM_ID,
} from '@angular/core';

import USALLib, {
  type LoopType,
  type AnimationType,
  type DirectionType,
  type USALDefaults,
  type USALConfig,
  type USALInstance,
} from '~/usal';

@Directive({
  selector: '[usal], [data-usal]',
  standalone: true,
})
export class USALDirective implements OnInit, OnChanges {
  @Input() usal?: string;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  private updateAttribute() {
    if (isPlatformBrowser(this.platformId)) {
      const nativeEl = this.el.nativeElement;
      const existing = nativeEl?.getAttribute?.('data-usal');
      const nextValue = this.usal || existing || 'fade';
      if (existing !== nextValue) {
        this.renderer.setAttribute(nativeEl, 'data-usal', nextValue);
      }
    }
  }

  ngOnInit() {
    this.updateAttribute();
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('usal' in changes) {
      this.updateAttribute();
    }
  }
}

@Injectable({ providedIn: 'root' })
export class USALService {
  config(): USALConfig;
  config(newConfig: Partial<USALConfig>): USALInstance;
  config(newConfig?: Partial<USALConfig>): USALInstance | USALConfig {
    if (newConfig) return USALLib.config(newConfig);
    return USALLib.config();
  }

  destroy(): Promise<void> {
    return USALLib.destroy();
  }

  restart(): Promise<USALInstance> {
    return USALLib.restart();
  }

  initialized(): boolean {
    return USALLib.initialized();
  }

  get version(): string {
    return USALLib.version;
  }
}

@NgModule({
  imports: [USALDirective],
  exports: [USALDirective],
  providers: [USALService],
})
export class USALModule {}

export type { LoopType, AnimationType, DirectionType, USALDefaults, USALConfig, USALInstance };

export default USALLib;

declare global {
  interface Window {
    USAL: USALInstance;
  }
}

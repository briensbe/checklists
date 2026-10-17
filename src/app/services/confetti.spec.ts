import { TestBed } from '@angular/core/testing';
import { ConfettiService } from './confetti';

describe('ConfettiService', () => {
  let service: ConfettiService;
  const originalMatchMedia = window.matchMedia;

  const stubReducedMotion = (reduce: boolean) => {
    window.matchMedia = ((query: string) => ({ matches: reduce && query.includes('reduce') }) as MediaQueryList) as typeof window.matchMedia;
  };

  beforeEach(() => {
    service = TestBed.inject(ConfettiService);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('charge la bibliothèque à la demande et lance une salve, sans animation si l’utilisateur la refuse', async () => {
    stubReducedMotion(false);
    const confetti = vi.fn();
    service.loader = vi.fn(async () => ({ default: confetti }) as never);

    expect(await service.launch()).toBe(true);
    expect(service.loader).toHaveBeenCalledTimes(1);
    expect(confetti).toHaveBeenCalledWith(expect.objectContaining({ disableForReducedMotion: true }));
  });

  it('ne charge rien quand l’utilisateur demande de réduire les animations', async () => {
    stubReducedMotion(true);
    service.loader = vi.fn();

    expect(await service.launch()).toBe(false);
    expect(service.loader).not.toHaveBeenCalled();
  });

  it('ignore un échec de chargement', async () => {
    stubReducedMotion(false);
    service.loader = vi.fn(async () => {
      throw new Error('réseau indisponible');
    });

    expect(await service.launch()).toBe(false);
  });
});

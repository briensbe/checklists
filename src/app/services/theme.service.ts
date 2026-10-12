import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_STORAGE_KEY = 'app_theme_preference';
  readonly isDarkMode = signal<boolean>(false);

  constructor() {
    this.initTheme();
  }

  private initTheme(): void {
    const saved = localStorage.getItem(this.THEME_STORAGE_KEY);
    if (saved) {
      this.setDarkMode(saved === 'dark');
    } else {
      // Détection préférence système
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setDarkMode(prefersDark);
    }
  }

  toggleTheme(): void {
    this.setDarkMode(!this.isDarkMode());
  }

  setDarkMode(isDark: boolean): void {
    this.isDarkMode.set(isDark);
    const theme = isDark ? 'dark' : 'light';
    localStorage.setItem(this.THEME_STORAGE_KEY, theme);

    const doc = document.documentElement;
    doc.classList.add('no-theme-transition');

    if (isDark) {
      doc.setAttribute('data-theme', 'dark');
    } else {
      doc.removeAttribute('data-theme');
    }

    // Force le recalcul immédiat sans transition
    window.getComputedStyle(doc).opacity;

    requestAnimationFrame(() => {
      doc.classList.remove('no-theme-transition');
    });
  }
}

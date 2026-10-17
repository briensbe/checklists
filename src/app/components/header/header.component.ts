import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideCircleCheckBig, LucideClipboardCheck, LucideLayers, LucideMoon, LucideSun } from '@lucide/angular';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LucideCircleCheckBig, LucideClipboardCheck, LucideLayers, LucideMoon, LucideSun],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  readonly themeService = inject(ThemeService);
}

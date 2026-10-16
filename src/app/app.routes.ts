import { Routes } from '@angular/router';
import { ChecklistsDashboardComponent } from './pages/checklists-dashboard/checklists-dashboard.component';
import { ChecklistRunnerComponent } from './pages/checklist-runner/checklist-runner.component';
import { TemplatesListComponent } from './pages/templates-list/templates-list.component';
import { TemplateBuilderComponent } from './pages/template-builder/template-builder.component';

import { canDeactivateTemplateBuilder } from './guards/template-builder.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'checklists', pathMatch: 'full' },
  { path: 'checklists', component: ChecklistsDashboardComponent },
  { path: 'checklists/:id', component: ChecklistRunnerComponent },
  { path: 'templates', component: TemplatesListComponent },
  { path: 'templates/builder', component: TemplateBuilderComponent, canDeactivate: [canDeactivateTemplateBuilder] },
  { path: 'templates/:id/edit', component: TemplateBuilderComponent, canDeactivate: [canDeactivateTemplateBuilder] },
  { path: '**', redirectTo: 'checklists' }
];

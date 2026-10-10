import { Routes } from '@angular/router';
import { ChecklistsDashboardComponent } from './pages/checklists-dashboard/checklists-dashboard.component';
import { ChecklistRunnerComponent } from './pages/checklist-runner/checklist-runner.component';
import { TemplatesListComponent } from './pages/templates-list/templates-list.component';
import { TemplateBuilderComponent } from './pages/template-builder/template-builder.component';

export const routes: Routes = [
  { path: '', redirectTo: 'checklists', pathMatch: 'full' },
  { path: 'checklists', component: ChecklistsDashboardComponent },
  { path: 'checklists/:id', component: ChecklistRunnerComponent },
  { path: 'templates', component: TemplatesListComponent },
  { path: 'templates/builder', component: TemplateBuilderComponent },
  { path: 'templates/:id/edit', component: TemplateBuilderComponent },
  { path: '**', redirectTo: 'checklists' }
];

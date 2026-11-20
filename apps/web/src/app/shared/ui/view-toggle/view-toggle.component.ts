import { Component, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type DataViewMode = 'table' | 'card';

@Component({
  selector: 'app-view-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './view-toggle.component.html',
  styleUrl: './view-toggle.component.scss',
})
export class ViewToggleComponent {
  readonly view = model<DataViewMode>('table');
  readonly viewChange = output<DataViewMode>();

  selectView(mode: DataViewMode): void {
    if (this.view() !== mode) {
      this.view.set(mode);
      this.viewChange.emit(mode);
    }
  }
}

import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SelectButton } from 'primeng/selectbutton';
import { ClinicAffiliation } from '@core/models';

type AffiliationOption = { label: string; value: ClinicAffiliation };

@Component({
    selector: 'app-affiliation-selector',
    standalone: true,
    imports: [ReactiveFormsModule, SelectButton],
    template: `
    <p-selectbutton
      [options]="options"
      optionLabel="label"
      optionValue="value"
      [allowEmpty]="false"
      [formControl]="control()"
    />
  `,
    styles: `
    :host {
      display: block;
      --p-togglebutton-background: #fff;
      --p-togglebutton-color: var(--text-main);
      --p-togglebutton-border-color: var(--surface-200);
      --p-togglebutton-hover-background: var(--auth-input-bg);
      --p-togglebutton-checked-background: #dfe6f8;
      --p-togglebutton-checked-color: var(--auth-primary);
      --p-togglebutton-checked-border-color: var(--auth-primary);
      --p-togglebutton-content-checked-background: transparent;
      --p-togglebutton-content-checked-shadow: none;
    }
    :host ::ng-deep {
      .p-selectbutton { display: flex; gap: 8px; }
      .p-togglebutton { flex: 1; border-radius: 8px; }
    }
  `,
})
export class AffiliationSelectorComponent {
    readonly control = input.required<FormControl<ClinicAffiliation>>();

    readonly options: AffiliationOption[] = [
        { label: 'Student', value: ClinicAffiliation.STUDENT },
        { label: 'Faculty', value: ClinicAffiliation.FACULTY },
        { label: 'Staff', value: ClinicAffiliation.STAFF },
    ];
}

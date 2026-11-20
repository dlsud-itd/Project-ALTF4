import { FormControl } from '@angular/forms';
import { requiredTextValidator } from './required-text.validator';

describe('requiredTextValidator', () => {
  it('rejects empty and whitespace-only input', () => {
    expect(requiredTextValidator(new FormControl(''))).toEqual({
      required: true,
    });
    expect(requiredTextValidator(new FormControl('   '))).toEqual({
      required: true,
    });
  });

  it('accepts text containing a non-whitespace character', () => {
    expect(requiredTextValidator(new FormControl(' checkup '))).toBeNull();
  });
});

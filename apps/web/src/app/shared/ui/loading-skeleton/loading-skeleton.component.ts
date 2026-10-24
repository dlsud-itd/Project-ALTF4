import { Component, computed, input } from '@angular/core';
import { Skeleton } from 'primeng/skeleton';

const DEFAULT_LINE_COUNT = 3;
const LINE_HEIGHT = '1rem';

// Grey placeholder lines shown while data is loading.
@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [Skeleton],
  templateUrl: './loading-skeleton.component.html',
  styleUrl: './loading-skeleton.component.scss',
})
export class LoadingSkeletonComponent {
  readonly lines = input<number>(DEFAULT_LINE_COUNT);
  readonly lineHeight: string = LINE_HEIGHT;

  readonly lineIndexes = computed<number[]>(() =>
    Array.from({ length: this.lines() }, (_: unknown, index: number) => index),
  );
}
import { Injectable, Signal, signal } from "@angular/core";


@Injectable({
  providedIn: 'root'
})
export class FeatureSelectService {

  // `equal: () => false` preserves the previous BehaviorSubject semantics: every changeSelectedFeature()
  // notifies consumers even when the index is unchanged, so re-selecting the same row re-triggers the
  // map fly-to / scroll side effects.
  private readonly _featureSelected = signal<string | null>(null, { equal: () => false });
  readonly currentSelected: Signal<string | null> = this._featureSelected.asReadonly();

  changeSelectedFeature(featureIndex: string) {
    this._featureSelected.set(featureIndex);
  }

}

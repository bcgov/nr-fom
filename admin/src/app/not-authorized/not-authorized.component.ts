
import { Component, input } from "@angular/core";

@Component({
    imports: [],
    selector: "app-not-authorized",
    templateUrl: "./not-authorized.component.html",
    styleUrl: "./not-authorized.component.scss"
})
export class NotAuthorizedComponent {
  // `loggedout` query param, bound as an input (string "true" → boolean).
  readonly loggedout = input(false, { transform: (v: string | boolean) => v === true || v === 'true' });

  login() {
    window.location.href = window.location.origin + "/admin";
  }
}

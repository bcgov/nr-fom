import { Component } from "@angular/core";

/**
 * Landing page served at /admin/logout.
 */
@Component({
    imports: [],
    selector: "app-logout",
    templateUrl: "./logout.component.html",
    styleUrl: "./logout.component.scss"
})
export class LogoutComponent {
  /**
  * Use a full browser navigation instead of the Angular Router. CognitoService.init()
  * runs only once when the page loads and skips this logout route. Reloading /admin
  * is therefore necessary to run the initializer again and start a fresh login.
   */
  login() {
    window.location.href = window.location.origin + "/admin";
  }
}

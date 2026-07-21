
import { Component, DestroyRef, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";

@Component({
    imports: [],
    selector: "app-not-authorized",
    templateUrl: "./not-authorized.component.html",
    styleUrl: "./not-authorized.component.scss"
})
export class NotAuthorizedComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  public loggedout = false;

  ngOnInit() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((paramMap) => {
        this.loggedout = paramMap.get("loggedout") === "true";
      });
  }

  login() {
    window.location.href = window.location.origin + "/admin";
  }
}

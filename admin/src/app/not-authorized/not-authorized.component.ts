
import { Component, OnInit, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

@Component({
    standalone: true,
    imports: [],
    selector: "app-not-authorized",
    templateUrl: "./not-authorized.component.html",
    styleUrls: ["./not-authorized.component.scss"]
})
export class NotAuthorizedComponent implements OnInit {
  private route = inject(ActivatedRoute);

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  public loggedout = false;

  ngOnInit() {
    this.route.queryParamMap
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((paramMap) => {
        this.loggedout = paramMap.get("loggedout") === "true";
      });
  }

  login() {
    window.location.href = window.location.origin + "/admin";
  }
}

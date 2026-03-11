## Plan: Redesign FOM Public Comment Review Page

Redesign the existing Angular `ReviewCommentsComponent` in the admin app to add a progress dashboard, split-pane layout, search/filtering, client-side pagination (50/page), bulk actions, keyboard shortcuts, and responsive mobile collapse — all using the existing Angular + Material + Bootstrap stack, wired to the real API (no mock data).

**Decisions**
- Angular, not React — redesign the existing component, not what the issue literally suggests
- Backend as-is — no API pagination needed; all comments are already fetched client-side, we paginate/filter in Angular
- "Not Applicable" label — map `IRRELEVANT` → "Not Applicable" in the UI only; backend enum unchanged
- Real API — no `mockData.ts`; use existing `PublicCommentService`
- Single PR — all features

---

### Phase 1: Progress Dashboard
- Create new `ProgressDashboardComponent` at `admin/src/app/foms/review-comments/progress-dashboard/`
- Takes comments array as input, computes counts per status + completion %, renders stat cards + progress bar
- Maps `IRRELEVANT` → "Not Applicable", null response → "Unactioned"

### Phase 2: Enhanced Split-Pane Layout
- Refactor `review-comments.component.html` — left pane (~40-50%), right pane (~50-60%), independent scrolling
- Refine SCSS with BC Gov color tokens (already in codebase)

### Phase 3: Comment List Enhancements
- Redesign each row: name, comment snippet, color-coded status badge, inline quick-action buttons (C/A/N)
- Add checkbox per row (wired in Phase 6)

### Phase 4: Search & Filtering
- Free-text search across `feedback` and `name` (client-side)
- Status filter dropdown: All / Considered / Addressed / Not Applicable / Unactioned
- Combined with existing scope filter using AND logic

### Phase 5: Pagination
- Client-side: 50 per page, Previous/Next + page number
- Page resets when filters change; maintains selected comment if still visible

### Phase 6: Bulk Actions
- Per-row checkboxes + "Select All (on page)" header checkbox
- Bulk action toolbar: choose status → "Apply" to all selected
- Sequential API calls; clear selection on page/filter change

### Phase 7: Comment Detail Enhancements
- "Save & Next Unactioned" button on `comment-detail` — saves, then auto-navigates to next unactioned comment

### Phase 8: Keyboard Shortcuts
- `C`/`A`/`N` → set status; `J`/`K` → navigate list
- Disabled when an input/textarea/select is focused

### Phase 9: Responsive Layout
- `@media (max-width: 768px)`: single-column, show list or detail, "Back to list" button

---

**Files to create**
- `admin/src/app/foms/review-comments/progress-dashboard/progress-dashboard.component.ts`
- `admin/src/app/foms/review-comments/progress-dashboard/progress-dashboard.component.html`
- `admin/src/app/foms/review-comments/progress-dashboard/progress-dashboard.component.scss`

**Files to modify**
- `admin/src/app/foms/review-comments/review-comments.component.ts` — major refactor (filtering, pagination, bulk, keyboard, inline status)
- `admin/src/app/foms/review-comments/review-comments.component.html` — full template redesign
- `admin/src/app/foms/review-comments/review-comments.component.scss` — layout, badges, responsive
- `admin/src/app/foms/review-comments/comment-detail/comment-detail.component.ts` — "Save & Next Unactioned"
- `admin/src/app/foms/review-comments/comment-detail/comment-detail.component.html` — new button

**Verification**
1. Unit tests for filtering, pagination math, bulk selection, keyboard guards
2. Manual test at `/comments/:appId` — all features
3. `ng build` and `ng lint` pass
4. `npm test` in admin/ passes

**Excluded (per issue)**
- No backend DB changes or migrations
- No "Select all filtered" across pages
- No CSV export, undo/redo, or multi-user conflict resolution
- No server-side pagination (can add later)

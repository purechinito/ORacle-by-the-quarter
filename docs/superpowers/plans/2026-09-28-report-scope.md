# Scoped shop reports and today's dashboard

The foundation audit found that aggregate sales reports exposed all staff sales even though sales history and detail enforce ownership. Fix this foundation gap before expanding operational scope.

Implement natively with a read-only final review of this slice. Existing user authorization covers bug fixes and the requested role-aware dashboard; no new business policy is invented. Align aggregates with the existing sales permission boundary.

1. Add failing API tests for manager business totals, counter own-sales totals/rows/returns, stock-only inventory results, active catalog count, Philippine-today dates and the matching range drilldown.
2. Read report data in one repeatable-read transaction. Use one actor/date predicate for monetary totals and supporting sales, and the same actor boundary for returns. Unavailable monetary fields are null, not misleading zeroes.
3. Return an explicit report scope and resolved date range. The dashboard requests Philippine today; its sales link opens Reports with those dates. Stock screens omit monetary cards and use inventory data. Counter receipt links remain authorized.
4. Run regression suite, typecheck/build, source review and fixes. Browser acceptance remains pending while the saved permission is blocked.

This closes the currently implemented report-scope mismatch. Global search, saved views, queues for unimplemented AR/AP and complete governed reporting remain required in FULL-ERP-COVERAGE.md.

Completed: three new tests RED→GREEN; full suite 74/74, typecheck/build pass. One independent read-only source review found no Important or Critical issues. Browser verification remains unavailable.

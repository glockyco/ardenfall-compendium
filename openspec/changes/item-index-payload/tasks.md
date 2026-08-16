## 1. Current-release measurement

- [ ] 1.1 Build the current release and record the item index HTML, hydration payload boundary, release identity and row count.
- [ ] 1.2 Measure filtering and paging interaction cost in a browser at recorded conditions.
- [ ] 1.3 Compare client-side filtering, server-side filtering and server-side pagination against the same reader scenarios.
- [ ] 1.4 Record the selected payload boundary, interaction boundary and evidence for the baseline.

## 2. Overview payload contract

- [ ] 2.1 List the item index columns, filters, table renderers and route values that readers consume.
- [ ] 2.2 Remove overview payload fields that no rendered index behaviour consumes.
- [ ] 2.3 If the measurement selects server requests, add request parameters and preserve the existing overview read model.
- [ ] 2.4 Add a reader-model test for columns, filters, paging and route links.

## 3. Recorded budget gate

- [ ] 3.1 Set the payload and interaction budgets from the current-release measurement evidence.
- [ ] 3.2 Add a build check that fails when the item-index payload exceeds its recorded budget.
- [ ] 3.3 Make the failure report the measured value, recorded budget, boundary and release conditions.
- [ ] 3.4 Add a browser smoke that exercises the hydrated item index and verifies the selected budget.

## 4. Release verification

- [ ] 4.1 Measure the optimized current release again and update the evidence without changing the budget silently.
- [ ] 4.2 Verify that filtering and paging preserve all reader-visible results at the recorded conditions.
- [ ] 4.3 Run the repository gate and archive this change after the budget check passes.

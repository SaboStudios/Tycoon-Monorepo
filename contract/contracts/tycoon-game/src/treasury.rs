#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TreasurySnapshot {
    pub sum_of_balances: u64,
    pub escrow: u64,
    pub liabilities: u64,
    pub treasury: u64,
}

impl TreasurySnapshot {
    /// Returns true iff the balance sheet invariant holds.
    pub fn invariant_holds(&self) -> bool {
        self.sum_of_balances
            .checked_add(self.escrow)
            .map(|lhs| lhs == self.liabilities.saturating_add(self.treasury))
            .unwrap_or(false)
    }

    /// Panics with a descriptive message if the invariant is violated.
    pub fn assert_invariant(&self) {
        assert!(
            self.invariant_holds(),
            "Treasury invariant violated: balances({}) + escrow({}) != liabilities({}) + treasury({})",
            self.sum_of_balances,
            self.escrow,
            self.liabilities,
            self.treasury
        );
    }
}

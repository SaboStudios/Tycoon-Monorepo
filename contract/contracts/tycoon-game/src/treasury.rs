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

#[cfg(test)]
mod tests {
    use super::TreasurySnapshot;

    fn balanced_snapshot() -> TreasurySnapshot {
        TreasurySnapshot {
            sum_of_balances: 10,
            escrow: 5,
            liabilities: 7,
            treasury: 8,
        }
    }

    fn unbalanced_snapshot() -> TreasurySnapshot {
        TreasurySnapshot {
            sum_of_balances: 10,
            escrow: 5,
            liabilities: 7,
            treasury: 9,
        }
    }

    #[test]
    fn invariant_holds_for_balanced_snapshot() {
        assert!(balanced_snapshot().invariant_holds());
    }

    #[test]
    fn invariant_fails_for_unbalanced_snapshot() {
        assert!(!unbalanced_snapshot().invariant_holds());
    }

    #[test]
    #[should_panic(expected = "Treasury invariant violated")]
    fn assert_invariant_panics_on_unbalanced_snapshot() {
        unbalanced_snapshot().assert_invariant();
    }
}

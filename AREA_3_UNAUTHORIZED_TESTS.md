# Unauthorized Access Tests

This document outlines comprehensive test cases for unauthorized access paths across all contracts including tycoon-token, tycoon-collectibles, tycoon-main-game, and tycoon-reward-system. The tests ensure that only authorized users can perform sensitive actions within the contracts.

## Test Cases

### 1. Non-Admin Cannot Mint
- **Description:** Test to ensure that non-admin users cannot call the mint function.
- **Expected Result:** Transaction should fail with a permission error.

### 2. Non-Admin Cannot Set Admin
- **Description:** Ensure non-admins cannot change the admin address.
- **Expected Result:** Transaction should fail with a permission error.

### 3. Non-Admin Cannot Pause/Unpause
- **Description:** Confirm that only admins can pause or unpause the contract.
- **Expected Result:** Transactions should fail with a permission error when a non-admin attempts to change the paused state.

### 4. Non-Admin Cannot Set Backend Minter
- **Description:** Test that non-admins cannot set a backend minter address.
- **Expected Result:** Transaction should fail with a permission error.

### 5. Non-Admin Cannot Withdraw Funds
- **Description:** Ensure that only admins can withdraw funds from the contract.
- **Expected Result:** Transactions should fail with a permission error when a non-admin attempts to withdraw.

### 6. Consistent Error Message Validation
- **Description:** Check that unauthorized actions return consistent error messages.
- **Expected Result:** All permission errors should provide a standardized error message indicating lack of authorization.
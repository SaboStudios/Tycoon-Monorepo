# Standardized Error Message Patterns

## Unauthorized Error
`Unauthorized: User does not have permission to perform this action.`

## Validation Errors
`ValidationError: {field} is required.`  
`ValidationError: {field} must be of type {type}.`  
`ValidationError: {field} exceeds maximum length of {maxLength}.`  

## State Errors
`StateError: The contract is not in the correct state for this action.`

## Initialization Errors
`InitializationError: Contract was not properly initialized.`  
`InitializationError: Missing mandatory parameters for contract setup.`

---

These error message patterns should be used consistently across all contracts to ensure clarity and maintainability in error handling.
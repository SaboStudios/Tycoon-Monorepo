# ACCESS_CONTROL.md

## NEAR Protocol Access Key Model Mapping

### Full Access Keys vs Function Access Keys
- **Full Access Keys** allow full access to the account and all associated functions.
- **Function Access Keys** are limited to specified functions, improving security.

## Single Admin vs Multisig Modes
- **Single Admin**: One person holds full control, simplifies management but can be risky.
- **Multisig**: Requires multiple approvals, enhancing security and collaboration.

## Role-Based Function Matrix for All Contracts  
| Role        | Full Access | Function Access |
|-------------|-------------|------------------|
| Admin       | Yes         | No               |
| User        | No          | Yes              |
| Viewer      | No          | Read Only        |

## Security Best Practices
- Use Function Access Keys to limit exposure.
- Regularly rotate keys and review permissions.
- Implement logging and monitoring.

## Threat Models
- Assume keys can be compromised; design systems to mitigate this risk.
- Consider insider threats and malicious actors.

## Testing Strategy
- Test for key management and access control flaws.
- Simulate attacks to validate security measures.

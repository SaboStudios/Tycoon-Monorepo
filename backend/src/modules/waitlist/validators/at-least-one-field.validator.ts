import {
    registerDecorator,
    ValidationOptions,
    ValidationArguments,
} from 'class-validator';

/**
 * Class-level decorator that ensures at least one of the specified fields
 * is present and non-empty on the decorated DTO.
 *
 * Usage:
 *   @AtLeastOneField(['wallet_address', 'email_address', 'telegram_username'])
 *   export class CreateWaitlistDto { ... }
 */
export function AtLeastOneField(
    fields: string[],
    validationOptions?: ValidationOptions,
) {
    return function (object: object) {
        registerDecorator({
            name: 'atLeastOneField',
            target: (object as { constructor: Function }).constructor,
            propertyName: fields[0],
            constraints: fields,
            options: {
                message: `At least one of the following fields is required: ${fields.join(', ')}`,
                ...validationOptions,
            },
            validator: {
                validate(
                    _value: unknown,
                    args: ValidationArguments,
                ): boolean {
                    const obj = args.object as Record<string, unknown>;
                    return args.constraints.some((field: string) => {
                        const val = obj[field];
                        return (
                            val !== undefined &&
                            val !== null &&
                            String(val).trim().length > 0
                        );
                    });
                },
            },
        });
    };
}

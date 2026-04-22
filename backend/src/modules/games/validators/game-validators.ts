import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { GameStatus } from '../entities/game.entity';

@ValidatorConstraint({ name: 'isGameCode', async: false })
export class IsGameCodeConstraint implements ValidatorConstraintInterface {
  validate(text: string) {
    // Game codes should be 6-character alphanumeric strings (uppercase letters and numbers)
    const gameCodeRegex = /^[A-Z0-9]{6}$/;
    return gameCodeRegex.test(text);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Game code must be exactly 6 characters containing only uppercase letters and numbers';
  }
}

export function IsGameCode(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsGameCodeConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'isValidGameStatusTransition', async: false })
export class IsValidGameStatusTransitionConstraint implements ValidatorConstraintInterface {
  validate(newStatus: string, args: ValidationArguments) {
    const object = args.object as any;
    const currentStatus = object.currentStatus;

    if (!currentStatus) {
      return true; // No current status, allow any status
    }

    // Define valid status transitions
    const validTransitions: Record<string, string[]> = {
      [GameStatus.PENDING]: [GameStatus.RUNNING, GameStatus.CANCELLED],
      [GameStatus.RUNNING]: [GameStatus.FINISHED, GameStatus.CANCELLED],
      [GameStatus.FINISHED]: [], // Terminal state
      [GameStatus.CANCELLED]: [], // Terminal state
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  defaultMessage(args: ValidationArguments) {
    const object = args.object as any;
    const currentStatus = object.currentStatus;
    const newStatus = args.value;

    return `Invalid status transition from ${currentStatus} to ${newStatus}`;
  }
}

export function IsValidGameStatusTransition(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidGameStatusTransitionConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'isValidPlayerCount', async: false })
export class IsValidPlayerCountConstraint implements ValidatorConstraintInterface {
  validate(count: number) {
    return count >= 2 && count <= 8;
  }

  defaultMessage() {
    return 'Number of players must be between 2 and 8';
  }
}

export function IsValidPlayerCount(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPlayerCountConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'isValidBlockchainAddress', async: false })
export class IsValidBlockchainAddressConstraint implements ValidatorConstraintInterface {
  validate(address: string) {
    if (!address) return true; // Optional field
    
    // Basic Ethereum address validation (0x + 40 hex characters)
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    return ethAddressRegex.test(address);
  }

  defaultMessage() {
    return 'Invalid blockchain address format. Expected Ethereum address format (0x...)';
  }
}

export function IsValidBlockchainAddress(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidBlockchainAddressConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'isValidContractGameId', async: false })
export class IsValidContractGameIdConstraint implements ValidatorConstraintInterface {
  validate(gameId: string) {
    if (!gameId) return true; // Optional field
    
    // Contract game ID should be a valid hex string or numeric string
    const hexRegex = /^0x[a-fA-F0-9]+$/;
    const numericRegex = /^\d+$/;
    
    return hexRegex.test(gameId) || numericRegex.test(gameId);
  }

  defaultMessage() {
    return 'Contract game ID must be a valid hex string (0x...) or numeric string';
  }
}

export function IsValidContractGameId(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidContractGameIdConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'isValidGamePlacement', async: false })
export class IsValidGamePlacementConstraint implements ValidatorConstraintInterface {
  validate(placements: any) {
    if (!placements || typeof placements !== 'object') {
      return false;
    }

    const playerIds = Object.keys(placements);
    
    // Check that all player IDs are numbers
    if (!playerIds.every(id => /^\d+$/.test(id))) {
      return false;
    }

    const ranks = Object.values(placements);
    
    // Check that all ranks are positive integers
    if (!ranks.every(rank => Number.isInteger(rank) && rank > 0)) {
      return false;
    }

    // Check that ranks are unique (no ties)
    const uniqueRanks = new Set(ranks);
    return uniqueRanks.size === ranks.length;
  }

  defaultMessage() {
    return 'Game placements must be an object with numeric player IDs as keys and unique positive integers as values';
  }
}

export function IsValidGamePlacement(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidGamePlacementConstraint,
    });
  };
}

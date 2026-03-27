# Admin Methods Documentation

## Tycoon Token
### Privileged Methods
- **mint(amount)**: Allows privileged users to mint new tokens.
  - **Authorization Pattern**: Only the owner can call this function.
  - **Error Messages**:  "Unauthorized access" if called by non-owner.
- **burn(amount)**: Allows privileged users to burn tokens.
  - **Authorization Pattern**: Only the owner can call this function.
  - **Error Messages**: "Unauthorized access" if called by non-owner.

## Tycoon Collectibles
### Privileged Methods
- **createCollectible(name, rarity)**: Allows the creation of new collectibles.
  - **Authorization Pattern**: Only the collectible manager can call this function.
  - **Error Messages**: "Unauthorized access" if called by non-manager.
- **transferCollectible(to, collectibleId)**: Transfers a collectible to another user.
  - **Authorization Pattern**: Any user can transfer their collectibles.
  - **Error Messages**: "Transfer not allowed" if trying to transfer a collectible not owned.

## Tycoon Main Game
### Privileged Methods
- **startGame()**: Starts the main game.
  - **Authorization Pattern**: Only the game manager can start the game.
  - **Error Messages**: "Game already started" if called when the game is running.
- **endGame()**: Ends the current game.
  - **Authorization Pattern**: Only the game manager can end the game.
  - **Error Messages**: "Game not active" if called when no game is running.

## Tycoon Reward System
### Privileged Methods
- **distributeRewards(users, amounts)**: Distributes rewards to users.
  - **Authorization Pattern**: Only the reward manager can call this function.
  - **Error Messages**: "Unauthorized access" if called by non-manager.
- **claimReward(user)**: Allows a user to claim their rewards.
  - **Authorization Pattern**: All users can claim their rewards.
  - **Error Messages**: "No rewards to claim" if the user has no pending rewards.

---

This documentation provides an overview of the privileged methods in each Tycoon contract including the required authorization patterns and potential error messages that may arise during contract interactions.
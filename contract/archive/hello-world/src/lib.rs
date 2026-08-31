#![no_std]

use soroban_sdk::{contract, contractimpl, Env, String};

#[contract]
pub struct HelloWorldContract;

#[contractimpl]
impl HelloWorldContract {
    pub fn hello(env: Env, to: String) -> String {
        String::from_slice(&env, "Hello, ").concat(to)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Env, String};

    #[test]
    fn test_hello() {
        let env = Env::default();
        let name = String::from_slice(&env, "Soroban");
        let result = HelloWorldContract::hello(env.clone(), name);
        assert_eq!(result, String::from_slice(&env, "Hello, Soroban"));
    }
}

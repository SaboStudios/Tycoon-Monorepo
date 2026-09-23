#![no_std]

#[cfg(test)]
mod tests {
    use soroban_sdk::{contract, contractimpl, Env, String};

    /// Minimal contract used as a smoke test for the integration-test harness.
    /// Deploy → call → assert, the same flow cross-contract tests will follow.
    #[contract]
    pub struct HelloSmoke;

    #[contractimpl]
    impl HelloSmoke {
        pub fn hello(env: Env, to: String) -> String {
            String::from_slice(&env, "Hello, ").concat(to)
        }
    }

    #[test]
    fn smoke_deploy_and_call() {
        let env = Env::default();
        let contract_id = env.register_contract(None, HelloSmoke);
        let client = HelloSmokeClient::new(&env, &contract_id);

        let name = String::from_slice(&env, "Soroban");
        let result = client.hello(&name);

        assert_eq!(result, String::from_slice(&env, "Hello, Soroban"));
    }
}

use ark_circom::{CircomBuilder, CircomCircuit, CircomConfig};
use ark_std::rand::thread_rng;

use ark_bn254::{Bn254, Fr};
use ark_crypto_primitives::snark::SNARK;
use ark_groth16::{Groth16, PreparedVerifyingKey, ProvingKey};

pub const R1CS_FILE: &str = "../artifacts/bn128/multiply_big.r1cs";
pub const WASM_FILE: &str = "../artifacts/bn128/multiply_big.wasm";

pub struct Groth16Circuit {
    pub circuit: CircomCircuit<Fr>,
    pub pk: ProvingKey<Bn254>,
    pub vk: PreparedVerifyingKey<Bn254>,
    pub inputs: Vec<Fr>,
}

impl Groth16Circuit {
    pub fn new() -> anyhow::Result<Self> {
        let config =
            CircomConfig::<Fr>::new(WASM_FILE, R1CS_FILE).map_err(|e| anyhow::anyhow!(e))?;

        let mut builder = CircomBuilder::new(config);
        (0..10000)
            .into_iter()
            .for_each(|i| builder.push_input("in1", i));
        (0..10000)
            .into_iter()
            .for_each(|i| builder.push_input("in2", i));
        builder.push_input("dummy", 0);

        let circuit = builder.setup();

        let pk = Groth16::<Bn254>::generate_random_parameters_with_reduction(
            circuit,
            &mut thread_rng(),
        )?;
        let vk = Groth16::<Bn254>::process_vk(&pk.vk)?;

        let circuit = builder.build().map_err(|e| anyhow::anyhow!(e))?;
        let inputs = circuit.get_public_inputs().unwrap();

        Ok(Self {
            circuit,
            pk,
            vk,
            inputs,
        })
    }
}

#[cfg(test)]
mod test {
    use std::time::Instant;
    use super::*;

    #[tokio::test]
    async fn test_prove_verify() {
        let prepare_time = Instant::now();
        
        let params = Groth16Circuit::new().unwrap();
        
        println!("prepared params in {:?}", prepare_time.elapsed());

        let prove_time = Instant::now();
        
        let proof = Groth16::<Bn254>::prove(&params.pk, params.circuit, &mut thread_rng()).unwrap();
        
        println!("proved in {:?}", prove_time.elapsed());

        let verify_time = Instant::now();

        let ok =
            Groth16::<Bn254>::verify_with_processed_vk(&params.vk, &params.inputs, &proof).unwrap();

        assert!(ok);
        
        println!("verified in {:?}", verify_time.elapsed());
    }
}

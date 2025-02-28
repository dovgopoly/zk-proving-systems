use ark_circom::{CircomBuilder, CircomConfig};
use ark_std::rand::thread_rng;

use ark_bn254::{Bn254, Fr};
use ark_crypto_primitives::snark::SNARK;
use ark_groth16::Groth16;

type GrothBn = Groth16<Bn254>;

pub fn prove_multiply() -> anyhow::Result<bool> {
    let cfg = CircomConfig::<Fr>::new(
        "../artifacts/MatrixPower.wasm",
        "../artifacts/MatrixPower.r1cs"
    ).map_err(|e| anyhow::anyhow!(e))?;

    let mut builder = CircomBuilder::new(cfg);

    (0..16).into_iter().for_each(|i| builder.push_input("in", i));
    builder.push_input("dummy", 0);

    let circom = builder.setup();

    let mut rng = thread_rng();
    let params = GrothBn::generate_random_parameters_with_reduction(circom, &mut rng)?;

    let circom = builder.build().map_err(|e| anyhow::anyhow!(e))?;

    let inputs = circom.get_public_inputs().unwrap();

    let proof = GrothBn::prove(&params, circom, &mut rng)?;

    let pvk = GrothBn::process_vk(&params.vk)?;

    let verified = GrothBn::verify_with_processed_vk(&pvk, &inputs, &proof)?;

    Ok(verified)
}

#[cfg(test)]
mod test {
    use super::*;

    #[tokio::test]
    async fn test_docs() {
        println!("{}", prove_multiply().unwrap());
    }
    
    // #[test]
    // fn test_groth16_circuit_multiply() {
    //     let rng = &mut ark_std::test_rng();
    // 
    //     // generate the setup parameters
    //     let (pk, vk) = Groth16::<Bls12_381>::circuit_specific_setup(
    //         MultiplyCircuit::<BlsFr> { a: BlsFr::from(5), b: BlsFr::from(2) },
    //         &mut OsRng,
    //     ).unwrap();
    //     
    //     for _ in 0..5 {
    //         let a = BlsFr::rand(rng);
    //         let b = BlsFr::rand(rng);
    //         let mut c = a;
    //         c.mul_assign(&b);
    //     
    //         // calculate the proof by passing witness variable value
    //         let proof = Groth16::<Bls12_381>::prove(
    //             &pk,
    //             MultiplyCircuit::<BlsFr> { a, b, },
    //             &mut OsRng,
    //         ).unwrap();
    //     
    //         // validate the proof
    //         assert!(Groth16::<Bls12_381>::verify(&vk, &[c], &proof).unwrap());
    //         assert!(!Groth16::<Bls12_381>::verify(&vk, &[a], &proof).unwrap());
    //     }
    // }
}
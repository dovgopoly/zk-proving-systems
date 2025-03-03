use std::fs::File;
use std::io::BufReader;
use ark_circom::{CircomBuilder, CircomConfig};
use ark_std::rand::thread_rng;

use ark_bn254::{Bn254, Fr};
use ark_circom::circom::R1CSFile;
use ark_crypto_primitives::snark::SNARK;
use ark_groth16::Groth16;

type GrothBn = Groth16<Bn254>;

pub fn read_r1cs() -> anyhow::Result<()> {
    let reader = BufReader::new(File::open("../artifacts/pow.r1cs")?);
    let r1cs: R1CSFile<Fr> = R1CSFile::new(reader)?;

    println!("Constraints Count: {:?}", r1cs.constraints.len());
    println!("Wires: {}", &r1cs.header.n_wires);

    for (i, constraint) in r1cs.constraints.iter().enumerate() {
        println!("Constraint #{}:", i + 1);
        
        println!("A: {:?}", &constraint.0);
        println!("B: {:?}", &constraint.1);
        println!("C: {:?}", &constraint.2);
        
        println!();
    }
    
    Ok(())
}

pub fn prove_multiply() -> anyhow::Result<bool> {
    let cfg = CircomConfig::<Fr>::new(
        "../artifacts/pow.wasm",
        "../artifacts/pow.r1cs"
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
    use std::ptr::read;
    use super::*;

    // #[tokio::test]
    // async fn test_docs() {
    //     println!("{}", prove_multiply().unwrap());
    // }

    #[tokio::test]
    async fn test_r1cs() {
        println!("{:?}", read_r1cs().unwrap());
    }
}

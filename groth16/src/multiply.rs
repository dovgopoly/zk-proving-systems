use ark_bn254::Fr;
use ark_relations::lc;
use ark_relations::r1cs::{ConstraintSynthesizer, ConstraintSystemRef, SynthesisError};

// Example circuit for proving knowledge of a square root
struct SquareRootCircuit {
    public_square: Option<Fr>,
    private_number: Option<Fr>,
}

impl ConstraintSynthesizer<Fr> for SquareRootCircuit {
    fn generate_constraints(self, cs: ConstraintSystemRef<Fr>) -> Result<(), SynthesisError> {
        // Allocate private input
        let a = cs.new_witness_variable(|| self.private_number.ok_or(SynthesisError::AssignmentMissing))?;

        // Allocate public input
        let b = cs.new_input_variable(|| self.public_square.ok_or(SynthesisError::AssignmentMissing))?;

        // Enforce a * a = b
        cs.enforce_constraint(lc!() + a, lc!() + a, lc!() + b)?;

        Ok(())
    }
}

#[cfg(test)]
mod test {
    use std::ops::MulAssign;
    use super::*;
    use ark_bls12_381::{Bls12_381, Fr as BlsFr};
    use ark_groth16::Groth16;
    use ark_snark::SNARK;
    use ark_std::{UniformRand};
    use rand::rngs::OsRng;

    #[test]
    fn test_docs() {
        use ark_ff::{Field, PrimeField};
        use ark_bn254::Fr;

        // Creating field elements
        let a = Fr::from(5);
        let b = Fr::from(3);

        // Field operations
        let sum = a + b;
        let product = a * b;
        let inverse = a.inverse().unwrap(); // Multiplicative inverse
        
        println!("Sum: {}", inverse);
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
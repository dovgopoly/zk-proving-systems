#![allow(non_snake_case)]

use libspartan::{InputsAssignment, Instance, SNARKGens, VarsAssignment, SNARK};
use std::fs;
use curve25519_dalek::scalar::Scalar;
use r1cs_file::{Constraint, R1csFile};
use wtns_file::WtnsFile;

pub const SYM_FILE: &str = "../artifacts/curve25519/pow.sym";
pub const R1CS_FILE: &str = "../artifacts/curve25519/pow.r1cs";
pub const WTNS_FILE: &str = "../artifacts/bn128/pow.wtns";

pub struct SpartanCircuit {
    pub num_cons: usize,
    pub num_inputs: usize,
    pub num_outputs: usize,
    pub num_vars: usize,
    pub num_non_zero_entries: usize,
    pub inst: Instance,
    pub assignment_vars: VarsAssignment,
    pub assignment_inputs: InputsAssignment,
}

impl SpartanCircuit {
    pub fn new() -> anyhow::Result<Self> {
        let r1cs = R1csFile::<32>::read(fs::read(R1CS_FILE)?.as_slice())?;

        let num_inputs = (r1cs.header.n_pub_in + r1cs.header.n_prvt_in) as usize;
        let num_outputs = r1cs.header.n_pub_out as usize;
        let num_vars = (r1cs.header.n_wires - num_inputs as u32 - num_outputs as u32 - 1) as usize;
        let num_cons = r1cs.header.n_constraints as usize;

        let mut A: Vec<(usize, usize, [u8; 32])> = vec![];
        let mut B: Vec<(usize, usize, [u8; 32])> = vec![];
        let mut C: Vec<(usize, usize, [u8; 32])> = vec![];

        let to_new_index = |i| {
            // (1, outputs, inputs, vars) -> (outputs, vars, 1, inputs)
            if i > num_outputs + num_inputs {
                i - num_inputs - 1
            } else if i >= num_outputs + 1 && i <= num_outputs + num_inputs {
                i + num_vars
            } else if i > 0 && i <= num_outputs {
                i - 1
            } else {
                num_vars + num_outputs
            }
        };

        r1cs.constraints
            .0
            .into_iter()
            .enumerate()
            .for_each(|(cons_id, Constraint(a, b, c))| {
                a.into_iter().for_each(|(value, wire_id)| {
                    A.push((
                        cons_id,
                        to_new_index(wire_id as usize),
                        value.as_slice().try_into().unwrap(),
                    ));
                });
                b.into_iter().for_each(|(value, wire_id)| {
                    B.push((
                        cons_id,
                        to_new_index(wire_id as usize),
                        value.as_slice().try_into().unwrap(),
                    ));
                });
                c.into_iter().for_each(|(value, wire_id)| {
                    C.push((
                        cons_id,
                        to_new_index(wire_id as usize),
                        value.as_slice().try_into().unwrap(),
                    ));
                });
            });

        let wtns = WtnsFile::<32>::read(fs::read(WTNS_FILE)?.as_slice())?
            .witness
            .0
            .into_iter()
            .map(|c| c.as_slice().try_into().unwrap())
            .collect::<Vec<[u8; 32]>>();
        let wtns = wtns[1..num_outputs + 1]
            .iter()
            .chain(wtns[num_outputs + num_inputs + 1..].iter())
            .chain([Scalar::ONE.to_bytes()].iter())
            .chain(wtns[num_outputs + 1..num_outputs + num_inputs + 1].iter())
            .map(|c| *c)
            .collect::<Vec<[u8; 32]>>();

        let inst = Instance::new(num_cons, num_vars + num_outputs, num_inputs, &A, &B, &C)
            .map_err(|_| anyhow::anyhow!("failed to create inst"))?;
        let assignment_vars = VarsAssignment::new(&wtns[..num_vars + num_outputs])
            .map_err(|_| anyhow::anyhow!("failed to create vars"))?;
        let assignment_inputs = InputsAssignment::new(&wtns[num_vars + num_outputs + 1..])
            .map_err(|_| anyhow::anyhow!("failed to create inputs"))?;
        let num_non_zero_entries = A.len().max(B.len()).max(C.len());

        Ok(Self {
            num_cons,
            num_inputs,
            num_outputs,
            num_vars,
            num_non_zero_entries,
            inst,
            assignment_vars,
            assignment_inputs,
        })
    }
}

#[cfg(test)]
mod test {
    use std::time::Instant;
    use merlin::Transcript;
    use super::*;

    #[test]
    fn test_prove_verify() {
        let preparing_time = Instant::now();
        
        let params = SpartanCircuit::new().unwrap();

        let gens = SNARKGens::new(
            params.num_cons,
            params.num_vars + params.num_outputs,
            params.num_inputs,
            params.num_non_zero_entries,
        );
        let (comm, decomm) = SNARK::encode(&params.inst, &gens);

        let mut prover_transcript = Transcript::new(b"snark_example");

        println!("prepared params in {:?}", preparing_time.elapsed());
        
        let prove_time = Instant::now();
        
        let proof = SNARK::prove(
            &params.inst,
            &comm,
            &decomm,
            params.assignment_vars,
            &params.assignment_inputs,
            &gens,
            &mut prover_transcript,
        );
        
        println!("proved in {:?}", prove_time.elapsed());
        
        let verify_time = Instant::now();
        
        let mut verifier_transcript = Transcript::new(b"snark_example");
        assert!(proof
            .verify(&comm, &params.assignment_inputs, &mut verifier_transcript, &gens)
            .is_ok());
        
        println!("verified in {:?}", verify_time.elapsed());
    }
}

import { expect } from "chai";
import { ethers, zkit } from "hardhat";

import { Reverter } from "./helpers/reverter";

import {
  MatrixAddition,
  MatrixDeterminant,
  MatrixHadamardProduct,
  MatrixPower,
  MatrixScalarMult,
  MatrixTransposition,
} from "@/generated-types/zkit";
import { MatrixConvolution } from "@/generated-types/zkit/core/main/matrix";
import { MatrixMultiply } from "@/generated-types/zkit/core/main/matrix/MatrixMultiply";
import { MatrixMultiply as multiplyVec } from "@/generated-types/zkit/core/main/matrix/multiplyVec.circom";
import { MatrixConvolution as MatrixConvolution2 } from "@/generated-types/zkit/core/main/matrix/convolution2.circom";

import {
  MatrixAdditionGroth16Verifier,
  MatrixConvolution_4_4_2_2_1_Groth16Verifier,
  MatrixConvolution_4_4_2_2_2_Groth16Verifier,
  MatrixDeterminantGroth16Verifier,
  MatrixHadamardProductGroth16Verifier,
  MatrixMultiply_4_4_4_1_Groth16Verifier,
  MatrixMultiply_4_4_4_4_Groth16Verifier,
  MatrixPowerGroth16Verifier,
  MatrixScalarMultGroth16Verifier,
  MatrixTranspositionGroth16Verifier,
} from "@/generated-types/ethers";
import snarkjs from "snarkjs";

function determinant(matrix: number[][]): number {
  const size = matrix.length;

  if (size === 1) {
    return matrix[0][0];
  }

  if (size === 2) {
    return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
  }

  let det = 0;

  for (let col = 0; col < size; col++) {
    const minor = getMinor(matrix, 0, col);

    det += Math.pow(-1, col) * matrix[0][col] * determinant(minor);
  }

  return det;
}

function getMinor(matrix: number[][], row: number, col: number) {
  return matrix.filter((_, r) => r !== row).map((row) => row.filter((_, c) => c !== col));
}

function matrixMultiply(A: number[][], B: number[][]) {
  const rowsA = A.length;
  const colsA = A[0].length;
  const rowsB = B.length;
  const colsB = B[0].length;

  // Check if the matrices can be multiplied
  if (colsA !== rowsB) {
    throw new Error("Matrices cannot be multiplied: incompatible dimensions.");
  }

  // Initialize the result matrix with zeros
  const result = Array.from({ length: rowsA }, () => Array(colsB).fill(0));

  // Perform multiplication
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      for (let k = 0; k < colsA; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }

  return result;
}

function performConvolution(matrix: number[][], filter: number[][], step: number) {
  let output: number[][] = [];
  const filterSize = filter.length;
  const matrixSize = matrix.length;

  for (let i = 0; i <= matrixSize - filterSize; i += step) {
    output[i] = [];

    for (let j = 0; j <= matrixSize - filterSize; j += step) {
      let sum = 0;

      for (let fi = 0; fi < filterSize; fi++) {
        for (let fj = 0; fj < filterSize; fj++) {
          sum += matrix[i + fi][j + fj] * filter[fi][fj];
        }
      }

      output[i].push(sum);
    }
  }

  return output;
}

function transposeMatrix(matrix: number[][]) {
  const rows = matrix.length;
  const cols = matrix[0].length;

  const transposed = Array.from({ length: cols }, () => Array(rows).fill(0));

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      transposed[j][i] = matrix[i][j];
    }
  }

  return transposed;
}

async function testMatrixAdd(input1: number[][], input2: number[][], circuit: MatrixAddition) {
  let real_result: number[][] = [];

  for (let i = 0; i < input1.length; i++) {
    real_result[i] = [];

    for (let j = 0; j < input1[i].length; j++) {
      real_result[i][j] = input1[i][j] + input2[i][j];
    }
  }

  await expect(circuit)
    .with.witnessInputs({ in1: input1, in2: input2, dummy: 0n })
    .to.have.witnessOutputs({ out: real_result });

  const proofStruct = await circuit.generateProof({ in1: input1, in2: input2, dummy: 0n });

  return proofStruct;
}

async function testMatrixDeterminant(input1: number[][], circuit: MatrixDeterminant) {
  const real_result = determinant(input1);

  await expect(circuit).with.witnessInputs({ in: input1, dummy: 0n }).to.have.witnessOutputs({ out: real_result });

  const proofStruct = await circuit.generateProof({ in: input1, dummy: 0n });

  return proofStruct;
}

async function testMatrixConvolation(
  input1: number[][],
  input2: number[][],
  step: number,
  circuit: MatrixConvolution | MatrixConvolution2,
) {
  const real_result = performConvolution(input1, input2, step);

  await expect(circuit)
    .with.witnessInputs({ in: input1, filter: input2, dummy: 0n })
    .to.have.witnessOutputs({ out: real_result });

  const proofStruct = await circuit.generateProof({ in: input1, filter: input2, dummy: 0n });

  return proofStruct;
}

async function testMatrixHadamard(input1: number[][], input2: number[][], circuit: MatrixHadamardProduct) {
  const real_result: number[][] = [];

  for (let i = 0; i < input1.length; i++) {
    real_result[i] = [];

    for (let j = 0; j < input1[i].length; j++) {
      real_result[i].push(input1[i][j] * input2[i][j]);
    }
  }

  await expect(circuit).with.witnessInputs({ in1: input1, in2: input2 }).to.have.witnessOutputs({ out: real_result });

  const proofStruct = await circuit.generateProof({ in1: input1, in2: input2 });

  return proofStruct;
}

async function testMatrixMultiply(input1: number[][], input2: number[][], circuit: MatrixMultiply) {
  const real_result = matrixMultiply(input1, input2).flat();

  await expect(circuit)
    .with.witnessInputs({ in1: input1, in2: input2, dummy: 0n })
    .to.have.witnessOutputs({ out: real_result });

  const proofStruct = await circuit.generateProof({ in1: input1, in2: input2, dummy: 0n });

  return proofStruct;
}

async function testMatrixVecMultiply(input1: number[][], input2: number[][], circuit: multiplyVec) {
  const real_result = matrixMultiply(input1, input2).flat();

  await expect(circuit)
    .with.witnessInputs({ in1: input1, in2: input2, dummy: 0n })
    .to.have.witnessOutputs({ out: real_result });

  const proofStruct = await circuit.generateProof({ in1: input1, in2: input2, dummy: 0n });

  return proofStruct;
}

async function testMatrixPow(input1: number[][], circuit: MatrixPower) {
  const real_result = matrixMultiply(matrixMultiply(input1, input1), input1).flat();

  await expect(circuit).with.witnessInputs({ in: input1, dummy: 0n }).to.have.witnessOutputs({ out: real_result });

  const proofStruct = await circuit.generateProof({ in: input1, dummy: 0n });

  return proofStruct;
}

async function testMatrixScalar(input1: number[][], input2: number, circuit: MatrixScalarMult) {
  const real_result: number[][] = [];

  for (let i = 0; i < input1.length; i++) {
    real_result[i] = [];

    for (let j = 0; j < input1[i].length; j++) {
      real_result[i].push(input1[i][j] * input2);
    }
  }

  await expect(circuit)
    .with.witnessInputs({ in: input1, scalar: input2, dummy: 0n })
    .to.have.witnessOutputs({ out: real_result });

  const proofStruct = await circuit.generateProof({ in: input1, scalar: input2, dummy: 0n });

  return proofStruct;
}

async function testMatrixTransposition(input1: number[][], circuit: MatrixTransposition) {
  const real_result = transposeMatrix(input1).flat();

  await expect(circuit).with.witnessInputs({ in: input1 }).to.have.witnessOutputs({ out: real_result });

  const proofStruct = await circuit.generateProof({ in: input1 });

  return proofStruct;
}

describe("Matrix add test", () => {
  const reverter = new Reverter();

  let verifier: MatrixAdditionGroth16Verifier;
  let circuit: MatrixAddition;

  before("setup", async () => {
    const MockVerifier = await ethers.getContractFactory("MatrixAdditionGroth16Verifier");

    verifier = await MockVerifier.deploy();
    circuit = await zkit.getCircuit("MatrixAddition");

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  it("[[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]] + [[15,14,13,12], [11,10,9,8], [7,6,5,4], [3, 2, 1, 0]]", async () => {
    const proof = await testMatrixAdd(
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
        [12, 13, 14, 15],
      ],
      [
        [15, 14, 13, 12],
        [11, 10, 9, 8],
        [7, 6, 5, 4],
        [3, 2, 1, 0],
      ],
      circuit,
    );

    await expect(circuit).to.useSolidityVerifier(verifier).and.verifyProof(proof);
  });

  it("[[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]] + [[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]]", async () => {
    const proof = await testMatrixAdd(
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
        [12, 13, 14, 15],
      ],
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
        [12, 13, 14, 15],
      ],
      circuit,
    );

    await expect(circuit).to.useSolidityVerifier(verifier).and.verifyProof(proof);
  });
});

describe("Matrix convalution test", () => {
  const reverter = new Reverter();

  let verifier1: MatrixConvolution_4_4_2_2_1_Groth16Verifier;
  let verifier2: MatrixConvolution_4_4_2_2_2_Groth16Verifier;

  let circuit1: MatrixConvolution;
  let circuit2: MatrixConvolution2;

  before("setup", async () => {
    const MockVerifier1 = await ethers.getContractFactory("MatrixConvolution_4_4_2_2_1_Groth16Verifier");
    const MockVerifier2 = await ethers.getContractFactory("MatrixConvolution_4_4_2_2_2_Groth16Verifier");

    verifier1 = await MockVerifier1.deploy();
    verifier2 = await MockVerifier2.deploy();

    circuit1 = await zkit.getCircuit("circuits/main/matrix/convolution.circom:MatrixConvolution");
    circuit2 = await zkit.getCircuit("circuits/main/matrix/convolution2.circom:MatrixConvolution");

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  it("[[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]] conv [[2,2],[3,3]], step 1", async () => {
    const proof = await testMatrixConvolation(
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
        [12, 13, 14, 15],
      ],
      [
        [2, 2],
        [3, 3],
      ],
      1,
      circuit1,
    );

    await expect(circuit1).to.useSolidityVerifier(verifier1).and.verifyProof(proof);
  });

  it("[[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]] conv [[2,2],[3,3]], step 2", async () => {
    const proof = await testMatrixConvolation(
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
        [12, 13, 14, 15],
      ],
      [
        [2, 2],
        [3, 3],
      ],
      2,
      circuit2,
    );

    await expect(circuit2).to.useSolidityVerifier(verifier2).and.verifyProof(proof);
  });
});

describe("Matrix determinant test", () => {
  const reverter = new Reverter();

  let verifier: MatrixDeterminantGroth16Verifier;
  let circuit: MatrixDeterminant;

  before("setup", async () => {
    const MockVerifier = await ethers.getContractFactory("MatrixDeterminantGroth16Verifier");

    verifier = await MockVerifier.deploy();
    circuit = await zkit.getCircuit("MatrixDeterminant");

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  it("det([[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]])", async () => {
    const proof = await testMatrixDeterminant(
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
        [12, 13, 14, 15],
      ],
      circuit,
    );

    await expect(circuit).to.useSolidityVerifier(verifier).and.verifyProof(proof);
  });
});

describe("Matrix hadamard product test", () => {
  const reverter = new Reverter();

  let verifier: MatrixHadamardProductGroth16Verifier;
  let circuit: MatrixHadamardProduct;

  before("setup", async () => {
    const MockVerifier = await ethers.getContractFactory("MatrixHadamardProductGroth16Verifier");

    verifier = await MockVerifier.deploy();
    circuit = await zkit.getCircuit("MatrixHadamardProduct");

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  it("[[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]] hadamard [[15,14,13,12], [11,10,9,8], [7,6,5,4], [3, 2, 1, 0]]", async () => {
    const proof = await testMatrixHadamard(
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
        [12, 13, 14, 15],
      ],
      [
        [15, 14, 13, 12],
        [11, 10, 9, 8],
        [7, 6, 5, 4],
        [3, 2, 1, 0],
      ],
      circuit,
    );

    await expect(circuit).to.useSolidityVerifier(verifier).and.verifyProof(proof);
  });

  it("[[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]] hadamard [[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]]", async () => {
    const proof = await testMatrixHadamard(
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
        [12, 13, 14, 15],
      ],
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
        [12, 13, 14, 15],
      ],
      circuit,
    );

    await expect(circuit).to.useSolidityVerifier(verifier).and.verifyProof(proof);
  });
});

describe("Matrix multiply test", () => {
  const reverter = new Reverter();

  let verifier: MatrixMultiply_4_4_4_4_Groth16Verifier;
  let circuit: MatrixMultiply;

  before("setup", async () => {
    const MockVerifier = await ethers.getContractFactory("MatrixMultiply_4_4_4_4_Groth16Verifier");

    verifier = await MockVerifier.deploy();
    circuit = await zkit.getCircuit("circuits/main/matrix/multiply.circom:MatrixMultiply");

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  it("[[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]] * [[15,14,13,12], [11,10,9,8], [7,6,5,4], [3, 2, 1, 0]]", async () => {
    const proof = await testMatrixMultiply(
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
        [12, 13, 14, 15],
      ],
      [
        [15, 14, 13, 12],
        [11, 10, 9, 8],
        [7, 6, 5, 4],
        [3, 2, 1, 0],
      ],
      circuit,
    );

    await expect(circuit).to.useSolidityVerifier(verifier).and.verifyProof(proof);
  });

  it("[[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]] * [[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]]", async () => {
    const proof = await testMatrixMultiply(
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
        [12, 13, 14, 15],
      ],
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
        [12, 13, 14, 15],
      ],
      circuit,
    );

    await expect(circuit).to.useSolidityVerifier(verifier).and.verifyProof(proof);
  });
});

describe("Matrix vector multiply test", () => {
  const reverter = new Reverter();

  let verifier: MatrixMultiply_4_4_4_1_Groth16Verifier;
  let circuit: multiplyVec;

  before("setup", async () => {
    const MockVerifier = await ethers.getContractFactory("MatrixMultiply_4_4_4_1_Groth16Verifier");

    verifier = await MockVerifier.deploy();
    circuit = await zkit.getCircuit("circuits/main/matrix/multiplyVec.circom:MatrixMultiply");

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  it("[[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]] * [[15], [11], [4], [1]]", async () => {
    const proof = await testMatrixVecMultiply(
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
        [12, 13, 14, 15],
      ],
      [[15], [11], [4], [1]],
      circuit,
    );

    await expect(circuit).to.useSolidityVerifier(verifier).and.verifyProof(proof);
  });
});

describe.only("Matrix power test", () => {
  const reverter = new Reverter();

  // let verifier: MatrixPowerGroth16Verifier;
  let circuit: MatrixPower;

  before("setup", async () => {
    // const MockVerifier = await ethers.getContractFactory("MatrixPowerGroth16Verifier");

    // verifier = await MockVerifier.deploy();
    circuit = await zkit.getCircuit("MatrixPower");

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  it("[[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]] ** 3", async () => {
    const input1 = [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9, 10, 11],
      [12, 13, 14, 15],
    ];

    const readR1cs = require("r1csfile").readR1cs;

    const r1cs = await readR1cs("pow.r1cs");

    const snarkjs = require("snarkjs");

    await snarkjs.wtns.calculate({ in: input1, dummy: 0n }, "pow.wasm", "pow.wtns");
    const wtns = await snarkjs.wtns.exportJson("pow.wtns");

    console.log(r1cs);
    console.log(wtns);

    let data: any = {}


    console.log("16: ", wtns[16]);
    console.log("17: ", wtns[17]);

    let prevIdx = 17;

    console.log("32: ", wtns[32]);
    console.log("33: ", wtns[33]);


    data["nInputs"] = r1cs.nPubInputs + r1cs.nPrvInputs;
    data["nOutputs"] = r1cs.nOutputs;
    data["nVars"] = r1cs.nVars;
    data["nConstraints"] = r1cs.nConstraints;

    data["wtns"] = [
        ...wtns.slice(r1cs.nOutputs + 1, r1cs.nOutputs + r1cs.nPubInputs + r1cs.nPrvInputs + 1),
        "1",
        ...wtns.slice(1, r1cs.nOutputs + 1),
        ...wtns.slice(r1cs.nOutputs + r1cs.nPubInputs + r1cs.nPrvInputs - 1)
    ];

    data["constraints"] = {};
    data["constraints"]["A"] = [];
    data["constraints"]["B"] = [];
    data["constraints"]["C"] = [];

    const toNewIndex = (index: number) => {
      if (index > r1cs.nOutputs + r1cs.nPubInputs + r1cs.nPrvInputs) {
        return index;
      }

      if (index >= r1cs.nOutputs + 1 && index <= r1cs.nOutputs + r1cs.nPubInputs + r1cs.nPrvInputs) {
        return index - r1cs.nOutputs - 1;
      }

      if (index > 0 && index <= r1cs.nOutputs) {
        return index + r1cs.nInputs;
      }

      return r1cs.nPubInputs + r1cs.nPrvInputs;
    };

    for (let i = 0; i < r1cs.constraints.length; i++) {
      const A_vec = r1cs.constraints[i][0];

      for (const [var_idx, value] of Object.entries(A_vec)) {
        data["constraints"]["A"].push([i, toNewIndex(parseInt(var_idx)), value]);
      }

      const B_vec = r1cs.constraints[i][1];

      for (const [var_idx, value] of Object.entries(B_vec)) {
        data["constraints"]["B"].push([i, toNewIndex(parseInt(var_idx)), value]);
      }

      const C_vec = r1cs.constraints[i][2];

      for (const [var_idx, value] of Object.entries(C_vec)) {
        data["constraints"]["C"].push([i, toNewIndex(parseInt(var_idx)), value]);
      }
    }

    const fs = require('fs');

    const jsonData = JSON.stringify(data, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2
    );


    fs.writeFile('data.json', jsonData, (err: any) => {
      if (err) {
        console.error('Error writing file:', err);
      } else {
        console.log('JSON file has been saved.');
      }
    });

    const real_result = matrixMultiply(matrixMultiply(input1, input1), input1).flat();

    console.log(real_result);
    //
    // const wtns = await circuit.calculateWitness({ in: input1, dummy: 0n });
    //
    // console.log(wtns.length);
    //
    // await expect(circuit).with.witnessInputs({ in: input1, dummy: 0n }).to.have.witnessOutputs({ out: real_result });
  });
});

describe("Matrix scalar mult test", () => {
  const reverter = new Reverter();

  let verifier: MatrixScalarMultGroth16Verifier;
  let circuit: MatrixScalarMult;

  before("setup", async () => {
    const MockVerifier = await ethers.getContractFactory("MatrixScalarMultGroth16Verifier");

    verifier = await MockVerifier.deploy();
    circuit = await zkit.getCircuit("MatrixScalarMult");

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  it("[[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]] * 3", async () => {
    const proof = await testMatrixScalar(
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
        [12, 13, 14, 15],
      ],
      3,
      circuit,
    );

    await expect(circuit).to.useSolidityVerifier(verifier).and.verifyProof(proof);
  });
});

describe("Matrix transposition test", () => {
  const reverter = new Reverter();

  let verifier: MatrixTranspositionGroth16Verifier;
  let circuit: MatrixTransposition;

  before("setup", async () => {
    const MockVerifier = await ethers.getContractFactory("MatrixTranspositionGroth16Verifier");

    verifier = await MockVerifier.deploy();
    circuit = await zkit.getCircuit("MatrixTransposition");

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  it("[[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]]", async () => {
    const proof = await testMatrixTransposition(
      [
        [0, 1, 2],
        [4, 5, 6],
        [8, 9, 10],
        [12, 13, 14],
      ],
      circuit,
    );

    await expect(circuit).to.useSolidityVerifier(verifier).and.verifyProof(proof);
  });
});

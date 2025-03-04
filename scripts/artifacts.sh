mkdir ../artifacts/bn128
mkdir ../artifacts/curve25519

../compiler/circom ../circom/circuits/main/matrix/pow.circom --r1cs --sym --prime curve25519 -o ../artifacts/curve25519
../compiler/circom ../circom/circuits/main/matrix/pow.circom --r1cs --sym --wasm --prime bn128 -o ../artifacts/bn128

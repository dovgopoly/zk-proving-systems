pragma circom 2.1.6;

include "../../../circuits/ec/curve.circom";

// secp256k1 params
component main = EllipticCurveScalarGeneratorMultiplication(64, 4, [16810331318623712729, 18122579188607900780, 17219079075415130087, 9032542404991529047], [7767825457231955894, 10773760575486288334, 17523706096862592191, 2800214691157789508], [2311270323689771895, 7943213001558335528, 4496292894210231666, 12248480212390422972]);

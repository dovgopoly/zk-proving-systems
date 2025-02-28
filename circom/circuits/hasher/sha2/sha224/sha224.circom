pragma circom 2.1.6;

include "../sha2Common.circom";
include "../sha256/sha256.circom";
include "./internal/sha224InitialValue.circom";

template Sha224HashChunks(BLOCK_NUM) {
    signal input in[BLOCK_NUM * 512];
    signal input dummy;
    
    signal output out[224];

    dummy * dummy === 0;
    
    signal states[BLOCK_NUM + 1][8][32];
    
    component iv = Sha224InitialValue();
    iv.out ==> states[0];
    
    component sch[BLOCK_NUM];
    component rds[BLOCK_NUM];
    
    for (var m = 0; m < BLOCK_NUM; m++) {        
        sch[m] = Sha2_224_256Shedule();
        sch[m].dummy <== dummy;

        rds[m] = Sha2_224_256Rounds(64);
        rds[m].dummy <== dummy;
        
        for (var k = 0; k < 16; k++) {
            for (var i = 0; i < 32; i++) {
                sch[m].chunkBits[k][i] <== in[m * 512 + k * 32 + (31 - i)];
            }
        }
        
        sch[m].outWords ==> rds[m].words;
        
        rds[m].inpHash <== states[m];
        rds[m].outHash ==> states[m + 1];
    }
    
    for (var j = 0; j < 7; j++) {
        for (var i = 0; i < 32; i++) {
            out[j * 32 + i] <== states[BLOCK_NUM][j][31 - i];
        }
    }
}

template Sha224HashBits(LEN) {
    signal input in[LEN];
    signal input dummy;
    
    signal output out[224];

    dummy * dummy === 0;

    component addPadding = ShaPadding(LEN, 512);
    addPadding.in <== in;

    var BLOCK_NUM = ((LEN + 1 + 128) + 512 - 1) \ 512;
    
    signal states[BLOCK_NUM + 1][8][32];
    
    component iv = Sha224InitialValue();
    iv.out ==> states[0];
    
    component sch[BLOCK_NUM];
    component rds[BLOCK_NUM];
    
    for (var m = 0; m < BLOCK_NUM; m++) {        
        sch[m] = Sha2_224_256Shedule();
        sch[m].dummy <== dummy;
        
        rds[m] = Sha2_224_256Rounds(64);
        rds[m].dummy <== dummy;
        
        for (var k = 0; k < 16; k++) {
            for (var i = 0; i < 32; i++) {
                sch[m].chunkBits[k][i] <== addPadding.out[m * 512 + k * 32 + (31 - i)];
            }
        }
        
        sch[m].outWords ==> rds[m].words;
        
        rds[m].inpHash <== states[m];
        rds[m].outHash ==> states[m + 1];
    }
    
    for (var j = 0; j < 7; j++) {
        for (var i = 0; i < 32; i++) {
            out[j * 32 + i] <== states[BLOCK_NUM][j][31 - i];
        }
    }
}

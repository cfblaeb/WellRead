#include "decoder.h"
#include <dmtx.h>
#include <stdio.h>
#include <string.h>
#include <pthread.h>

typedef struct _thread_data_t {
    void *output;
    unsigned char *pxl;
    unsigned int *width;
    unsigned int *height;
    unsigned int i;
} thread_data_t;


int decode_worker(unsigned char *output, unsigned char *pxl, unsigned int width, unsigned int height) {
    DmtxImage      *img;
    DmtxDecode     *dec;
    DmtxRegion     *reg;
    DmtxMessage    *msg;

    int returnval = -1;
    img = dmtxImageCreate(pxl, width, height, DmtxPack24bppRGB);

    // first attempt, shrink it
    int scale = 2;
    dec = dmtxDecodeCreate(img, scale);
    DmtxTime timeout = dmtxTimeAdd(dmtxTimeNow(), 10);
    reg = dmtxRegionFindNext(dec, &timeout);
    if(reg != NULL) {
        msg = dmtxDecodeMatrixRegion(dec, reg, DmtxUndefined);
        if(msg != NULL) {
            memcpy(output, msg->output, msg->outputIdx+1);
            dmtxMessageDestroy(&msg);
            returnval = 1;
        }
        dmtxRegionDestroy(&reg);
    }
    dmtxDecodeDestroy(&dec);
    if (returnval != 1) {
        // second attempt, defaults
        scale = 1;
        dec = dmtxDecodeCreate(img, scale);
        DmtxTime timeout = dmtxTimeAdd(dmtxTimeNow(), 10);
        reg = dmtxRegionFindNext(dec, &timeout);
        if(reg != NULL) {
            msg = dmtxDecodeMatrixRegion(dec, reg, DmtxUndefined);
            if(msg != NULL) {
                memcpy(output, msg->output, msg->outputIdx+1);
                dmtxMessageDestroy(&msg);
                returnval = 1;
            }
            dmtxRegionDestroy(&reg);
        }
        dmtxDecodeDestroy(&dec);
    }
    if (returnval != 1) {
        // third attempt, set threshold 100
        scale = 1;
        dec = dmtxDecodeCreate(img, scale);
        dmtxDecodeSetProp(dec, DmtxPropEdgeThresh, 100);
        DmtxTime timeout = dmtxTimeAdd(dmtxTimeNow(), 10);
        reg = dmtxRegionFindNext(dec, &timeout);
        if(reg != NULL) {
            msg = dmtxDecodeMatrixRegion(dec, reg, DmtxUndefined);
            if(msg != NULL) {
                memcpy(output, msg->output, msg->outputIdx+1);
                dmtxMessageDestroy(&msg);
                returnval = 1;
            }
            dmtxRegionDestroy(&reg);
        }
        dmtxDecodeDestroy(&dec);
    }
    // redo the 3 first ones, but now with extra time
    if (returnval != 1) {
        // shrink
        scale = 2;
        dec = dmtxDecodeCreate(img, scale);
        DmtxTime timeout = dmtxTimeAdd(dmtxTimeNow(), 100);
        reg = dmtxRegionFindNext(dec, &timeout);
        if(reg != NULL) {
            msg = dmtxDecodeMatrixRegion(dec, reg, DmtxUndefined);
            if(msg != NULL) {
                memcpy(output, msg->output, msg->outputIdx+1);
                dmtxMessageDestroy(&msg);
                returnval = 1;
            }
            dmtxRegionDestroy(&reg);
        }
        dmtxDecodeDestroy(&dec);
    }
    if (returnval != 1) {
        // defaults
        scale = 1;
        dec = dmtxDecodeCreate(img, scale);
        DmtxTime timeout = dmtxTimeAdd(dmtxTimeNow(), 100);
        reg = dmtxRegionFindNext(dec, &timeout);
        if(reg != NULL) {
            msg = dmtxDecodeMatrixRegion(dec, reg, DmtxUndefined);
            if(msg != NULL) {
                memcpy(output, msg->output, msg->outputIdx+1);
                dmtxMessageDestroy(&msg);
                returnval = 1;
            }
            dmtxRegionDestroy(&reg);
        }
        dmtxDecodeDestroy(&dec);
    }
    if (returnval != 1) {
        // set threshold 100
        scale = 1;
        dec = dmtxDecodeCreate(img, scale);
        dmtxDecodeSetProp(dec, DmtxPropEdgeThresh, 100);
        DmtxTime timeout = dmtxTimeAdd(dmtxTimeNow(), 100);
        reg = dmtxRegionFindNext(dec, &timeout);
        if(reg != NULL) {
            msg = dmtxDecodeMatrixRegion(dec, reg, DmtxUndefined);
            if(msg != NULL) {
                memcpy(output, msg->output, msg->outputIdx+1);
                dmtxMessageDestroy(&msg);
                returnval = 1;
            }
            dmtxRegionDestroy(&reg);
        }
        dmtxDecodeDestroy(&dec);
    }

    dmtxImageDestroy(&img);
    return returnval;
}


void *thread_entry(void *arg) {
    thread_data_t *tdata = (thread_data_t *)arg;
    unsigned char (*real_output)[40] = tdata->output;
    unsigned char *pxl = tdata->pxl;
    unsigned int *width = tdata->width;
    unsigned int *height = tdata->height;
    unsigned int i = tdata->i;

    int bytepos = 0;
    // fast forward to initial bytepos
    for (unsigned int bp = 0; bp < i*96; bp++) {
        bytepos += width[bp] * height[bp] * 3;
    }
    int returnval;
    for (unsigned int ii = 0; ii < 96; ii++) {
        returnval = decode_worker(real_output[96*i+ii], pxl+bytepos, width[96*i+ii], height[96*i+ii]);
        bytepos += width[96*i+ii] * height[96*i+ii] * 3;
        if (returnval == -1) {
            strcpy( (char*) real_output[96*i+ii], "failed");
        }
    }
    pthread_exit(NULL);
}


int do_it(unsigned char result_vector[5*96][40], unsigned char *image_pxl, unsigned int width[5*96], unsigned int height[5*96])
{
    int returnval = 0;

    const unsigned int NUM_THREADS = 5;
    pthread_t thr[NUM_THREADS];
    thread_data_t tdata[NUM_THREADS];
    for (unsigned int i = 0;i < NUM_THREADS; i++) {
        tdata[i].output = result_vector;
        tdata[i].pxl = image_pxl;
        tdata[i].width = width;
        tdata[i].height = height;
        tdata[i].i = i;
        pthread_create(&thr[i], NULL, thread_entry, &tdata[i]);
    }
    for (unsigned int i = 0; i < NUM_THREADS; i ++) {
        pthread_join(thr[i], NULL);
    }

    return returnval;
}
#include "decoder.h"
#include <dmtx.h>
#include <stdio.h>
#include <string.h>
#include <pthread.h>

typedef struct _thread_data_t {
    unsigned char *output;
    unsigned char *pxl;
    unsigned int width;
    unsigned int height;
} thread_data_t;

void *decode_worker(void *arg) {
    thread_data_t *tdata = (thread_data_t *)arg;
    unsigned char *output = tdata->output;
    unsigned char *pxl = tdata->pxl;
    unsigned int width = tdata->width;
    unsigned int height = tdata->height;

   DmtxImage      *img;
   DmtxDecode     *dec;
   DmtxRegion     *reg;
   DmtxMessage    *msg;

   int scale = 1;

   img = dmtxImageCreate(pxl, width, height, DmtxPack24bppRGB);//DmtxPack24bppRGB);
   dec = dmtxDecodeCreate(img, scale);
   /*
      DmtxPropEdgeMin, DmtxPropEdgeMax
      DmtxPropScanGap
      DmtxPropFnc1
      DmtxPropSquareDevn (0, 90)
      DmtxPropSymbolSize
      DmtxPropEdgeThresh (1, 100)
      DmtxPropXmin, DmtxPropXmax
      DmtxPropYmin, DmtxPropYmax:

      dmtxDecodeSetProp(dec, prop, value);
   */
   DmtxTime timeout = dmtxTimeAdd(dmtxTimeNow(), 10000);
   reg = dmtxRegionFindNext(dec, &timeout);
   if(reg != NULL) {
      msg = dmtxDecodeMatrixRegion(dec, reg, DmtxUndefined);
      if(msg != NULL) {
         memcpy(output, msg->output, msg->outputIdx);
         dmtxMessageDestroy(&msg);

      }
      dmtxRegionDestroy(&reg);
   }
   dmtxDecodeDestroy(&dec);
   dmtxImageDestroy(&img);
   pthread_exit(NULL);
}



int do_it(unsigned char result_vector[96][40], unsigned char *image_pxl, unsigned int *width, unsigned int *height, unsigned int wells)
{
    int returnval = 0;
    int bytepos = 0;

    pthread_t thr[96];
    thread_data_t tdata[96];
    for (unsigned int i = 0;i < 96; i++) {
        //returnval = decode_worker(result_vector[i], image_pxl+bytepos, width[i], height[i]);
        tdata[i].output = result_vector[i];
        tdata[i].pxl = image_pxl+bytepos;
        tdata[i].width = width[i];
        tdata[i].height = height[i];
        pthread_create(&thr[i], NULL, decode_worker, &tdata[i]);
        bytepos += width[i]*height[i]*3;
    }
    for (unsigned int i = 0; i < 96; i ++) {
        pthread_join(thr[i], NULL);
    }

    return returnval;
}
#include "decoder.h"
#include <iostream>

int decode_worker(unsigned char *output, unsigned char *pxl, unsigned int width, unsigned int height) {
   int return_status = 0;
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
         return_status = 1;
      }
      dmtxRegionDestroy(&reg);
   }
   dmtxDecodeDestroy(&dec);
   dmtxImageDestroy(&img);
   return return_status;
}

int do_it(unsigned char *decoded, unsigned char *image_pxl, unsigned int *width, unsigned int *height, unsigned int wells) {
    int returnval = 0;
    int bytepos = 0;
    for (unsigned int i = 0;i < wells; i++) {
        returnval = decode_worker(decoded, image_pxl+bytepos, width[i], height[i]);
        std::cout << i << std::endl;
        if (returnval == 1) {
        std::cout << decoded << std::endl;
        } else {
        std::cout << "failed" << std::endl;
        }
        bytepos += width[i]*height[i]*3;


    }

    return returnval;
}
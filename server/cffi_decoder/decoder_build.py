from cffi import FFI
ffibuilder = FFI()

ffibuilder.cdef("int do_it(unsigned char *decoded, unsigned char *image_pxl, unsigned int *width, unsigned int *height, unsigned int wells);")

ffibuilder.set_source("_decoder",  # name of the output C extension
"""
    #include "decoder.h"
""",
    sources=['decoder.cpp'],   # includes pi.c as additional sources
    libraries=['dmtx'],
    source_extension='.cpp')    # on Unix, link with the math library

if __name__ == "__main__":
    ffibuilder.compile()
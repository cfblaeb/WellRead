from cffi import FFI
ffibuilder = FFI()

ffibuilder.cdef("int do_it(unsigned char result_vector[96][40], unsigned char *image_pxl, unsigned int *width, unsigned int *height, unsigned int wells);")

ffibuilder.set_source(
    "_decoder",
    '#include "decoder.h"',
    sources=['decoder.c'],
    libraries=['dmtx', 'pthread'],
    extra_compile_args=['-std=c18'])

if __name__ == "__main__":
    ffibuilder.compile()
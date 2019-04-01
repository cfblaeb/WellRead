from cffi import FFI
ffibuilder = FFI()

ffibuilder.cdef(f"int do_it(unsigned char result_vector[{5*96}][40], unsigned char *image_pxl, unsigned int width[{5*96}], unsigned int height[{5*96}]);")

ffibuilder.set_source(
    "_decoder",
    '#include "decoder.h"',
    sources=['decoder.c'],
    libraries=['dmtx', 'pthread'],
    extra_compile_args=['-std=c18'])

if __name__ == "__main__":
    ffibuilder.compile()
---
title: The Game of Life
description: Conway's Game of Life — WebGL ping-pong texture simulation and a bit-packed version that uses every bit in the texture.
layout: game_of_life
date: '2026-02-15'
draft: false
---

## The Game of Life

The Game of Life was devised by the mathematician John Conway. The rules are
simple. Given a 2D grid, we are going to evolve its state at a series of
discrete timesteps. At a given timestep, a cell is either alive or dead. To
determine if the cell is alive or dead in the next time step, we use that
cell's current state, as well as the states of its 8 neighbors. If a live cell
has fewer than two live neighbors or more than three, it dies. If a dead cell
has exactly three live neighbors, it comes alive.

The algorithm for the Game of Life is extremely amenable to the GPU: It is
embarrassingly parallel - the next state of a given cell is determined entirely
by the current state of the board, so no cells' next states depend on other
cells' next states, and they can all be computed in parallel. It is also visual,
so data on the GPU for computation can be sampled for rendering.

First, we have a simple WebGL implementation, followed by another using doing
some bit packing in a WebGL texture to shoehorn compute into WebGL2. Finally,
there is a WebGPU implementation. This mostly served as an intro that API, and
also showed off that native compute shader support simplifies your life quite a
lot.

[[[GAME_OF_LIFE_DEMO]]]

The default board contains a single glider. You can randomize the board, or you
can click a cell to switch it to/from alive from/to dead.

The randomize button will run through all the cells, turning them alive with a
probability you can set with the input field. It defaults to 0.5.

The program works by rendering back and forth between two textures. Upon CPU
updates, the board is buffered to the currently active framebuffer. The value
in the red channel of the texture represents a cell's status. A good next step
would be to utilize the other 3 channels, and try to map each quadrant of the
board to a particular channel.

The fragment shader runs a 3x3 kernel over the board. The perimeter of the
kernel is all 1s, and there's an 9 in the middle. The 1s count the number of
surrounding alive cells, and the 9 bumps that sum if the current cell is alive.
The 9 is an idea I got from [Inigo
Quilez.](https://iquilezles.org/articles/gameoflife/) Initially, I had nested
branches in the shader - one to check if the current cell was alive or dead,
and then nested update rules. This is correct, but by inflating the sum for
living cells, you can unambiguously map the convolution sum in a selection.

## WebGL, with no bits wasted

[[[IMPROVED_GAME_OF_LIFE_DEMO]]]

This is another WebGL implementation of GoL, but this one uses every single bit
inside that texture to do the simulation.

Again, ping-pong textures. The tricky part here is figuring out how to use the
extra 31 bits I'm wasting in the previous implementation. You'll notice that
the grid is checkered turqoise and mustard in the background. There are 4 rows
and 8 columns in that checkerboard pattern. Textures can store RGBA data - 4 
channels - and they can store each channel in an 8 bit integer. If we can
figure out how to map a channel to a row, and a bit to a column, then we can
(somewhat) ergonomically index into the cells from the textures in GLSL and
perform our simulation.

To control how the texture is laid out on the GPU, we use the internal format
of the texture. I guess "internal" is from the driver or the GPU's perspective.
Internal format is in contrast to format, which is the format of the data on
the CPU, which you would know as the CPU side programmer. Usually, you want the
internal and CPU formats to be compatible, because this will save data
conversions from happening behind your back and hurting your performance.

There is still some disconcordance in interpreting the data in the shaders.
GLSL normalizes the data in an RGB8 texture between 0 and 1 when sampling.
To undo that, It's necessary to multiply by 255.0 in the shader. Then we
can happily pack and unpack our bits using integral types. This could be
avoided by using integer textures, but I stuck with RGB8 for portability.

Along with internal_format, the other notable texture (or more like sampler,
actually) parameter is the wrap setting. In this case, using gl.REPEAT
trivially gives us periodic boundary conditions. This just means that the
bottom neighbors of the bottom cells are the top cells, and likewise for other
dimensions. We just wrap around the board. This was a welcome reprieve from
complexity after thinking about how to pack and unpack the texture data itself.

Each one of the 32 cells samples the [0, 1] x [0, 1] texture coordinate range.
In generating the vertex data for each cell, the position coordinates are the
NDC positions of a given cell, which gives a unique position for each cell on
the screen. However the texture coordinates repeat for sampling. The texture is
almost like a stack of 32 textures, one in each bit. The fragment coordinate in
the shader can tell us which one of the 32 bits to sample, after some
modulo/division. I tried to do the familiar texture debugging trick in the
output, by adding the texture coordinates to the fragment's R and G channels.
The effect is a little bit difficult to balance with the section tints without
becoming overwhemling, but it does remind me that each section gets the full
texture coordinate range.

An interesting hack I had to apply: to prevent writes in the simulation from
overwriting many texels, I had to draw in glPoints mode, and use a gl_PointSize
of 1.0.

## In WebGPU

[[[WEBGPU_GAME_OF_LIFE_DEMO]]]

This is a modernized version of the above. Again we ping-pong, but this time
using a storage buffer, which is then sampled in the fragment shader when we
render. Compared to the WebGL version, there are no tricks here.

There is an interesting serialization step needed in the compute shader. In 
WebGL, we compute the state of the 32 cells using a for loop in GLSL. It 
never really occurred to me that this sidesteps a data race. In WebGPU where
we use a compute shader that has a separate invocation for every cell, there 
are 32 invocations that map to the same u32 in the storage array. This
requires a synchronization step among the threads writing to shared u32s. 
In WGSL, this requires the use of atomicAnd and atomicOr instructions for the
bit packing.

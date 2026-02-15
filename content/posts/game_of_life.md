---
title: The Game of Life
description: Conway's Game of Life — WebGL ping-pong texture simulation and a bit-packed version that uses every bit in the texture.
layout: game_of_life
date: '2026-02-15'
draft: false
---

## The Game of Life

The Game of Life was devised by the mathematician John Conway.
The rules are simple. At a given moment in time, a cell is
either alive or dead. A cell interacts with its 8 neighbors at
every time step. If a live cell has fewer than two live
neighbors, it dies. If a live cell has two or three live
neighbors, it survives. If it has more than three, it dies. If
a dead cell has exactly three live neighbors, it comes alive.

The default board contains a single glider. You can randomize
the board, or you can click a cell to switch it to/from alive
from/to dead.

[[[GAME_OF_LIFE_DEMO]]]

The randomize button will run through all the cells,
turning them alive with a probability you can set with
the input field. It defaults to 0.5.

The program works by rendering back and forth between two
textures. Upon CPU updates, the board is buffered to the
currently active framebuffer. The value in the red channel of
the texture represents a cell's status. A good next step would
be to utilize the other 3 channels, and try to map each
quadrant of the board to a particular channel.

The fragment shader runs a 3x3 kernel over the board. The
perimeter of the kernel is all 1s, and there's an 9 in the
middle. The 1s count the number of surrounding alive cells,
and the 9 bumps that sum if the current cell is alive. The
9 is an idea I got from
[Inigo Quilez.](https://iquilezles.org/articles/gameoflife/)
Initially, I had nested
branches in the shader - one to check if the current cell was
alive or dead, and then nested update rules. This is correct,
but by inflating the sum for living cells, you can
unambiguously map the convolution sum in a selection with
the GLSL ternary operator, which will probably compile down
to a branch free program on the GPU.

## WebGL, with no bits wasted

[[[IMPROVED_GAME_OF_LIFE_DEMO]]]

Like above, this is another WebGL implementation of GoL, but
this one uses every single bit inside that texture to do the
simulation.

This one similarly uses the ping-pong textures. The tricky part
here is figuring out how to use the extra 31 bits I'm wasting
in the previous implementation. You'll notice that the grid is
checkered turqoise and mustard in the background (byproducts of
the arbitrary colors and dye strength I put in my shader).
There are 4 rows and 8 columns in that checkerboard pattern.
The internal format for the texture I use for the ping-ponging
is RGBA8, meaning that the memory allocated on the GPU for the
texture is interpreted as 4, 8-bit channels. This checkerboard
corresponds to that layout.

The simulation basically happens in a single one of these 32
sections. I can extract the height/width of the draw buffer of
the JS canvas. I can pick how many of those pixels I want to
correspond to a single GoL cell, and that sets the dimensions
of the simulation, and how finely I partition NDC screen-space
coords to ultimately render to the screen.

From the dimensions of the screen, I can divide by 4 and 8 to
get the dimensions of the textures I will work with -
"dimensions of the texture" is imprecise, in that the texture
still goes from 0.0 to 1.0, being a normal 2D sampler. But the
conceptual shift is that now I think of the texture as being
like a stack of 32 sections. When visualizing what exactly I
need to compute here, I think about a single one of these
sections, one 32nd of the board, and I consider the dimensions
of a single section as "dimensions of the texture"

Now the game is to index into the texture and get the right
bit. I can provide the resolution of the board to my shaders via
a uniform, and then scale that down by (8, 4) to get the resolution
of a section. In a given shader invocation, I determine what happens
to "this cell" in the next iteration. I know where "this cell" is
through gl_FragCoord, which lets me map from pixels to GoL space.
I set the texture's wrapping mode to REPEAT, which lets me trivially
handle cases where I offset into a neighboring section. But it's
still necessary to handle changing the section itself when accounting
for the offset.

To perform the sum, I provide the 3x3 convolution kernel like the
first implementation, and do a simple for loop over an index from
0 to 9. That index mod 3 and integer divided by 3 gives you an x
and y offset, and then you can just extract the bit from the texture
at the current cell plus that offset. That loop is nested inside a
another loop running over the 32 bits at that shader invocations
texture coordinates. Some bit shifting and OpenGL texture int/float
conversions finish the computation.

Finally, coloring the cells uses the same function to extract
the bits of the texture, just invoked a single time at the current
cell, and if 1, it uses white as the alive color, and the
background color - mustard or turqoise - for the dead color.

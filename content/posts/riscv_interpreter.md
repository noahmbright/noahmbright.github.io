---
title: RISC-V Interpreter and Computer Architecture Simulator
description: Final project for computer architecture — an out-of-order, speculative RISC-V simulator with branch prediction and register renaming.
date: '2026-02-15'
draft: false
---

This was the final project for the computer architecture course I
took in my last semester of school, which was really influential on
me. I would link to the code if it wasn't going to be reused in
future semesters.

The goal of the project was to write a program that simulated an
out-of-order (OoO), speculative CPU with branch prediction and register
renaming. The simulator would read in a configuration
parameterizing the CPU, as well as a program describing the initial
state of the CPU's memory and a program written in a subset of
RISC-V assembly. Our simulator would interpret the program and
output the execution time in number of cycles, as well as report
bottlenecks in the execution pipeline, as measured by where it was
necessary to issue no-ops to stall processing.

To increase performance, modern CPUs use pipelined OoO
execution. Pipelining is a form of parallelism achieved
by having different processing steps occur
simultaneously for different instructions. For example,
in one CPU cycle, an add instruction might be executing the
addition operation while the next instruction is
getting fetched. That way, the CPU's add unit and
fetch unit are both utilized, instead of waiting
for each other, even though their results are unrelated.

OoO execution is another optimization that allows
instructions to execute when their data is ready, as
opposed to when it is their turn in program order. For
example, maybe you want to add a and b. First you'd load
them into registers, and then in a third instruction you'd
add them. But maybe your program loads a and b, but then
immediately after also loads c and d, which are unrelated
to the a+b intruction. An OoO processor can execute
a+b as soon as a and b are ready, even if that might be
before c and d are loaded, as per program order.

OoO execution and pipelining obviously introduce
concerns about program correctness. These issues are
called hazards, and come in three flavors: write after
write (WAW), write after read (WAR), and read after
write (RAW). A RAW hazard is a true data dependence; a
register is written to, and then afterwards, a subsequent
instruction reads the result. WAWs occur when two instructions
write to the same register; if the writes occur out of order,
thereafter, the register contains the wrong value. In the WAR
case, a write to a register occurs after a read; if these are
out of order, the read value will prematurely read a value
that should not yet have been there.

These hazards only exist because a register is at risk
of being written to before it ought to be. This issue
wouldn't exist if we had an infinitely large register
file to use, and only wrote to a register once. This
motivates a technique called register renaming. The
processor has a limited number of physical registers,
while a compiler can output code using any number of
"architected" registers. The processor keeps a mapping
of its physical registers to the compiler's architected
registers, as well as a free list of registers that do
not currently contain a live architected register's
value. When an architected register is written to, it
gets assigned a new free physical register. This allows
the processor to maintain an appearance of only writing
to unused registers, despite its finite register file.

The real complication in the processor was the use of branch
prediction along with OoO speculative execution. Branch
instructions in the program are assigned a branch predictor, a
state machine describing if the branch is likely to be taken or
not; it's possible that this prediction is incorrect.

Since the processor is pipelined and executing out of order,
it fetches a branch instruction and guesses what comes next,
and actually continues updating its state with results that
might become void if it turns out its branch prediction was
wrong.

Between processing results and writing to the register
file, results are stored in the ReOrder Buffer (ROB).
The ROB is a queue that literally re-applies order to
instructions; when instructions are fetched, they get
stored in buffers called reservation stations, where
they wait for their operands. This is what allows them
to execute when ready, as opposed to when its their
turn in program order. And importantly, this is where
they actually begin to become disordered. Before OoO
execution, instructions get tagged in an entry in the
ROB. When an instruction's result is ready, it gets
written to its corresponding ROB entry, and marked as
ready to commit to the register file. If a result makes
it to the front of the queue and is tagged as ready,
it was truly supposed to execute, it had the correct
operands, and will get written to the register. If
an incorrectly predicted branch instruction makes it
to the front of the queue, the processor can flush its
state, correct its program counter, and restart execution
from where it should have gone.

There's some extra bookkeeping in the register file and
those reservation stations that I won't go into here,
but that's the high level overview a semester of
computer architecture. Extensions to the project would
be to include a more sophisticated memory model for
caches, paging, and multicore coherency.

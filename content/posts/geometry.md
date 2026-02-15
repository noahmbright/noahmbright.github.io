---
title: Geometry
description: Orbiting sphere demo with Blinn-Phong lighting. Adjust camera, sphere, and projection from Learn OpenGL and WebGL2 Fundamentals.
layout: geometry
date: '2026-02-15'
draft: false
---

A little showcase of study results from
[Learn OpenGL](https://learnopengl.com/),
[WebGL2 Fundamentals](https://webgl2fundamentals.org/),
and [SongHo Ahn's page](https://www.songho.ca/index.html).
The Open/Web GL pages have been really helpful in learning how to do
graphics programming in practice. Even with the physics and math
background I have, visualizing and turning the common graphics
transformations - model to world to view to clip to screen space -
is still not entirely intuitive to me. You can easily take those for
granted and call into a library that gives you whatever you need,
but writing my own functions for doing those transformations has
been a really insightful exercise. LearnOpenGL is probably the best
resource I know for getting started with graphics, but learning
WebGL in vanilla JavaScript has forced me to implement my own little
linear algebra library, and SongHo's lessons have been really valuable
in understanding and sanity checking my progress there.

While not the most visally impressive, this orbiting sphere demo
covers a really large part of graphics fundamentals. First of all,
generating the sphere vertices and indices, and then the sphere
itself can be translated and scaled, the camera field of view
and near/far projection planes shifted. The sphere has basic
lighting applied to it in the fragment shader. Building all
that up from scratch has been a valuable experience, especially
the camera look at matrix and the projection matrix.

In this demo, the camera is always focused on the origin. You can
adjust the background color, the position of the camera and sphere,
and some of the camera projection parameters to view the orbiting
light from different angles. The lighting is a simple Blinn-Phong
shader.

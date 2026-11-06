#!/bin/sh
# Genera variantes oscura y clara desde src/*.svg
set -e
mkdir -p ../assets
for f in src/*.svg; do
  n=$(basename "$f" .svg)
  sed -e 's/{{BG}}/#090B10/g; s/{{SURFACE}}/#0D1119/g; s/{{GRID}}/#121826/g; s/{{GRID2}}/#1E2636/g; s/{{TEXT}}/#E8EDF5/g; s/{{MUTED}}/#6B7790/g; s/{{ACCENT}}/#00D4FF/g; s/{{BLUE}}/#526BFF/g' "$f" > "../assets/$n-dark.svg"
  sed -e 's/{{BG}}/#F6F8FB/g; s/{{SURFACE}}/#FFFFFF/g; s/{{GRID}}/#E9EDF4/g; s/{{GRID2}}/#D3DAE6/g; s/{{TEXT}}/#090B10/g; s/{{MUTED}}/#66728A/g; s/{{ACCENT}}/#0077B6/g; s/{{BLUE}}/#3A50E0/g' "$f" > "../assets/$n-light.svg"
done

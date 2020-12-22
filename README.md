# mpr-again

Here I am trying to redo an old HTML5 project for an MPR image viewer. This time the image cache is a single mosaic image to speed up data transfer. The current cache size in the browser is large enough to store a 512x512x512 volume as a 2D texture in 16bit. 

We can also compress the image in 8bit as a JPEG. The demo shows a single axial slice in 256x256x256, an overlay with a colormap and transparency and a label field displaying atlas label.

![Example](/images/voxelViewer.gif "VoxelViewer demo")
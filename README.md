# mpr-again

Here I am trying to redo an old HTML5 project for an MPR image viewer. This time the image cache is a single mosaic image to speed up data transfer. The current cache size in the browser is large enough to store a 512x512x512 volume as a 2D texture in 16bit. 

We can also compress the image in 8bit as a JPEG. The demo shows a single axial slice in 256x256x256, an overlay with a colormap and transparency and a label field displaying atlas label. The overlay is a trivial reprocessing of the primary axial slice information with a thresholding to mask out the background.

All intensity based computations are done on the browser using OpenCV.js, Image-js.js, and web-workers.

![Example](/images/voxelViewer.gif "VoxelViewer demo")

The above movie is an animated GIF. It will take a while for your browser to download the file before it starts playing back in full speed (captured on Mac Pro, 2018).

## How to test

This example contains the data for one brain (/data directory). You may test this step on your machine (assuming you have php installed, e.g. 'brew install php') by:
```
git clone https://github.com/HaukeBartsch/mpr-again.git
cd mpr-again
php -S localhost:8080
```

After these steps you should be able to navigate with Chrome to http://localhost:8080.

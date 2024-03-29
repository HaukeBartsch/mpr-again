# mpr-again

Here I am trying to redo an old HTML5 project for an MPR image viewer. This time the image cache is a single mosaic image to speed up data transfer. The current cache size in the browser is large enough to store a 512x512x512 volume as a 2D texture in 16bit. 

We can also compress the image in 8bit as a JPEG. The demo shows a single axial slice in 256x256x256, an overlay with a colormap and transparency and a label field displaying atlas label. The overlay is a trivial reprocessing of the primary axial slice information with a thresholding to mask out the background.

All intensity based computations are done on the browser using OpenCV.js, Image-js.js, and web-workers.

![Example](/images/voxelViewer.gif "VoxelViewer demo")

The above movie is an animated GIF. It will take a while for your browser to download the file before it starts playing back in full speed (captured on Mac Pro, 2018).

## How to test

The data folder contains the data for one brain (/data directory). You may test the viewer using those datasets (assuming you have php and git installed, e.g. 'brew install php; brew install git') by:
```
git clone https://github.com/HaukeBartsch/mpr-again.git
cd mpr-again
php -S localhost:8080
```

Navigate with Chrome to http://localhost:8080 to see the example. Navigation in axial orientation is done using left-mouse, hold and move the mouse up and down.

![Example](/images/label_example.jpg "VoxelViewer demo")

A first timing of the solution shows that on my MacBook Pro laptop rendering of the anatomical image, a color overlay and the freesurfer atlas results in a rendering performance of about 200 slices per second (chrome browser).

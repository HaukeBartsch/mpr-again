const mouse = { x: 0, y: 0, button: false, wheel: 0, lastX: 0, lastY: 0, drag: false, dragx: 0, dragy: 0 };

const ctx1 = jQuery('#mpr1')[0].getContext("2d");
const ctx1_overlay = jQuery('#mpr1_overlay')[0].getContext("2d");
const ctx1_atlas = jQuery('#mpr1_atlas')[0].getContext("2d");

// real height and width of cache mosaic
var imageWidth = 11776; // 40 images
var imageHeight = 11776; // 41 images
var dims = [512, 512, 512];
var numImagesX = Math.floor(imageWidth / dims[0]);
var numImagesY = Math.floor(imageWidth / dims[1]);
var position = [Math.floor(dims[0] / 2), Math.floor(dims[1] / 2), Math.floor(dims[2] / 2)];
var Primary = new Image();
var OverlayOrig = new Image(); // the original overlay before processing
var Overlay = new Image();  // the overlay after processing
var Atlas = new Image();
var t1_buffer_ctx;
var t1_canvas;
var atlas_outlines;

var primary_loaded = false;
var overlay_loaded = false;
var previous_timestamp;
function draw(timestamp) {
    if (primary_loaded)
        updateMPRPrimary();
    if (overlay_loaded)
        updateMPROverlay();
    if (atlas_outlines)
        updateAtlasOverlays();

    requestAnimationFrame(draw);
}

var last_position_atlas; // cache this to make animation requests faster
var requireNewDraw_atlas = false;
function updateAtlasOverlays() {
    if (typeof atlas_outlines == 'undefined')
        return;

    if (typeof last_position_atlas == 'undefined' || (last_position_atlas[0] != position[0] || last_position_atlas[1] != position[1] || last_position_atlas[2] != position[2])) {
        requireNewDraw_atlas = true;
    }

    // just draw them as colored dots and we don't need to define any polygons
    var pos = position[0]; // use this slice
    if (atlas_outlines[pos].length < 1)
        return;

    if (requireNewDraw_atlas) {

        requireNewDraw_atlas = false;

        var canvas = jQuery('#mpr1_atlas')[0];
        ctx1_atlas.clearRect(0, 0, canvas.width, canvas.height);

        var width = canvas.width; // jQuery('#mpr1').width();
        var height = canvas.height; // jQuery('#mpr1').height();

        // our input image is square so we can just do a single max
        var scale = [1.0, 1.0]; // one scale to rule them both
        var offset = [0, 0];
        if (width > height) { // whatever the larger dimension
            scale[1] = 1.0 / (height / width);
            // we need an offset to center the smaller dimension
            offset[1] = (height - (scale[1] * height)) / 2;
        } else {
            scale[0] = 1.0 / (width / height); // height will be 100%
            offset[0] = (width - (scale[0] * width)) / 2;
        }

        var idxy = Math.floor(position[0] / numImagesX);
        var idxx = position[0] - (idxy * numImagesX);
        var offsetX = dims[0] * idxx;
        var offsetY = dims[1] * idxy;
        if (typeof atlas_outlines[pos] != 'undefined') {
            // draw these points
            for (var i = 0; i < atlas_outlines[pos].length; i++) {
                // ok, the index is the type of region - color
                ctx1_atlas.fillStyle = "#999911";
                for (var roi = 0; roi < atlas_outlines[pos].length; roi++) {
                    for (var point = 0; point < atlas_outlines[pos][roi].length; point++) {
                        var x = atlas_outlines[pos][roi][point][0] - offsetX;
                        var y = atlas_outlines[pos][roi][point][1] - offsetY;
                        x = offset[0] + scale[0] * (x / dims[0] * width);
                        y = offset[1] + scale[1] * (y / dims[1] * height);
                        ctx1_atlas.fillRect(x, y, .5, .5);
                    }
                }
            }
        }
    }
}

var last_position; // cache this to make animation requests faster
var last_position_overlay; // cache this to make animation requests faster
var requireNewDraw = false;
var requireNewDraw_overlay = false;
// we have three MPRs that we need to compute
function updateMPRPrimary() {
    if (typeof last_position == 'undefined' || (last_position[0] != position[0] || last_position[1] != position[1] || last_position[2] != position[2])) {
        requireNewDraw = true;
    }
    if (requireNewDraw) {
        startTime = (new Date()).getTime();

        requireNewDraw = false;
        var idxy = Math.floor(position[0] / numImagesX);
        var idxx = position[0] - (idxy * numImagesX);
        var canvas = jQuery('#mpr1')[0];

        // the height and width of the output window
        var width = canvas.width; // jQuery('#mpr1').width();
        var height = canvas.height; // jQuery('#mpr1').height();

        // our input image is square so we can just do a single max
        var scale = [1.0, 1.0]; // one scale to rule them both
        var offset = [0, 0];
        if (width > height) { // whatever the larger dimension
            scale[1] = 1.0 / (height / width);
            // we need an offset to center the smaller dimension
            offset[1] = (height - (scale[1] * height)) / 2;
        } else {
            scale[0] = 1.0 / (width / height); // height will be 100%
            offset[0] = (width - (scale[0] * width)) / 2;
        }
        // now we can scale the output canvas to the same size

        ctx1.filter = "brightness(150%)"; // we can adjust brightness and contrast using filter
        ctx1.drawImage(Primary,
            idxy * dims[0],
            idxx * dims[1],
            dims[0],
            dims[1],
            offset[0], offset[1], scale[0] * width, scale[1] * height
        );
        var perc = [
            ((position[0] / (dims[0] - 1))),
            ((position[1] / (dims[1] - 1))),
            ((position[2] / (dims[2] - 1)))
        ];

        var crosshair_horz = jQuery('#mpr1').parent().find('.crosshair-horizontal');
        jQuery(crosshair_horz).css('top', (offset[1] + (perc[1] * scale[1] * height)) + "px");
        var crosshair_vert = jQuery('#mpr1').parent().find('.crosshair-vertical');
        jQuery(crosshair_vert).css('left', (offset[0] + (perc[2] * scale[0] * width)) + "px");

        //console.log("Did draw now update last_position");
        last_position = [position[0], position[1], position[2]];

        var pos = position[0]; var orient = "axial";
        jQuery('#mpr1_message1').text(orient + " slice: " + pos + " [" + ((new Date()).getTime() - startTime) + "ms]");
        jQuery('#mpr1_message3').text(position.join(", "));
    }
}

// what if we process the whole image once. 
function updateMPROverlay() {
    if (typeof last_position_overlay == 'undefined' || (last_position_overlay[0] != position[0] || last_position_overlay[1] != position[1] || last_position_overlay[2] != position[2])) {
        requireNewDraw_overlay = true;
    }
    if (requireNewDraw_overlay) {
        last_position_overlay = [position[0], position[1], position[2]];
        startTime = (new Date()).getTime();

        requireNewDraw_overlay = false;
        var idxy = Math.floor(position[0] / numImagesX);
        var idxx = position[0] - (idxy * numImagesX);
        var canvas = jQuery('#mpr1_overlay')[0];
        ctx1_overlay.clearRect(0, 0, canvas.width, canvas.height);

        // the height and width of the output window
        var width = canvas.width; // jQuery('#mpr1').width();
        var height = canvas.height; // jQuery('#mpr1').height();

        // our input image is square so we can just do a single max
        var scale = [1.0, 1.0]; // one scale to rule them both
        var offset = [0, 0];
        if (width > height) { // whatever the larger dimension
            scale[1] = 1.0 / (height / width);
            // we need an offset to center the smaller dimension
            offset[1] = (height - (scale[1] * height)) / 2;
        } else {
            scale[0] = 1.0 / (width / height); // height will be 100%
            offset[0] = (width - (scale[0] * width)) / 2;
        }
        // now we can scale the output canvas to the same size

        ctx1_overlay.drawImage(Overlay,
            idxy * dims[0],
            idxx * dims[1],
            dims[0],
            dims[1],
            offset[0], offset[1], scale[0] * width, scale[1] * height
        );

        //console.log("Did draw now update last_position");

        var pos = position[0]; var orient = "axial";
        jQuery('#mpr1_message2').text("Overlay " + orient + " slice: " + pos + " [" + ((new Date()).getTime() - startTime) + "ms]");
    }
}


function mouseEvents(e) {
    var mpr = '#mpr1';
    if (e.target == jQuery('#mpr1')[0]) {
        mpr = '#mpr1';
    }
    if (e.target == jQuery('#mpr2')[0]) {
        mpr = '#mpr2';
    }
    if (e.target == jQuery('#mpr3')[0]) {
        mpr = '#mpr3';
    }
    mouse.button = e.type === "mousedown" ? true : e.type === "mouseup" ? false : mouse.button;

    const bounds = jQuery(mpr)[0].getBoundingClientRect();
    if (e.type === "mousedown" || e.type === "mouseup") {
        //mouse.lastx = e.pageX - bounds.left - scrollX;
        //mouse.lasty = e.pageY - bounds.top - scrollY;
        mouse.lasty = e.pageY;
        if (mpr === "#mpr1")
            mouse.dragy = position[0];
        else if (mpr === "#mpr2")
            mouse.dragy = position[1];
        else if (mpr === "#mpr3")
            mouse.dragy = position[2];

        e.preventDefault();
    } else if (e.type === "mousemove" && mouse.button) {
        // mousemove
        const bounds = jQuery(mpr)[0].getBoundingClientRect();
        //mouse.y = e.pageY - bounds.top - scrollY;
        mouse.y = e.pageY;
        var val = 0.2 * (mouse.y - mouse.lasty);
        val = (val >= 0 || -1) * Math.floor(Math.abs(val));

        if (isFinite(val)) {
            if (mpr === '#mpr1') {
                position[0] = mouse.dragy + val;
                if (position[0] < 0)
                    position[0] = 0;
                if (position[0] >= dims[0])
                    position[0] = dims[0] - 1;
                //updateImagesByPosition(position[0], mpr);
            } else if (mpr === "#mpr2") {
                position[1] = mouse.dragy + val;
                if (position[1] < 0)
                    position[1] = 0;
                if (position[1] >= dims[1])
                    position[1] = dims[1] - 1;
                //updateImagesByPosition(position[1], mpr);
            } else if (mpr === "#mpr3") {
                position[2] = mouse.dragy + val;
                if (position[2] < 0)
                    position[2] = 0;
                if (position[2] >= dims[2])
                    position[2] = dims[2] - 1;
                //updateImagesByPosition(position[2], mpr);
            }
        }
        e.preventDefault();
    }
}

function resize() {
    requireNewDraw = true; // redraw even if the position did  not change
    requireNewDraw_overlay = true;
    requireNewDraw_atlas = true;
    jQuery('.MPR').css('height', jQuery(window).height() / 2.0);

    // set size of canvas once
    var canvas = jQuery('#mpr1_overlay')[0];
    canvas.width = jQuery('#mpr1_overlay').width();
    canvas.height = jQuery('#mpr1_overlay').height();

    canvas = jQuery('#mpr1_atlas')[0];
    canvas.width = jQuery('#mpr1_atlas').width();
    canvas.height = jQuery('#mpr1_atlas').height();

    canvas = jQuery('#mpr1')[0];
    canvas.width = jQuery('#mpr1').width();
    canvas.height = jQuery('#mpr1').height();
}

var atlas_w; // the web-worker that will compute the regions of interest in atlas space

//
// cache the overlay in OverlayOrig, processed image in Overlay
//
jQuery(document).ready(function () {
    console.log("got some code");

    // adjust size of the MPR windows
    jQuery(window).resize(function () {
        resize();
    });
    resize();

    jQuery('#mpr1').on('DOMMouseScroll mousewheel', function (e) {
        if (e.originalEvent.wheelDelta / 120 > 0) {
            position[0]++;
            if (position[0] >= dims[0])
                position[0] = 0;
        } else if (e.originalEvent.wheelDelta / 120 < 0) {
            position[0]--;
            if (position[0] < 0)
                position[0] = dims[0] - 1;
        }
        //updateImagesByPosition(position[0], '#mpr1');
        console.log(position.join());
    });

    jQuery('#mpr2').on('DOMMouseScroll mousewheel', function (e) {
        if (e.originalEvent.wheelDelta / 120 > 0) {
            position[1]++;
            if (position[1] >= dims[1])
                position[1] = 0;
        } else if (e.originalEvent.wheelDelta / 120 < 0) {
            position[1]--;
            if (position[1] < 0)
                position[1] = dims[1] - 1;
        }
        //updateImagesByPosition(position[1], '#mpr2');
        console.log(position.join());
    });

    jQuery('#mpr3').on('DOMMouseScroll mousewheel', function (e) {
        if (e.originalEvent.wheelDelta / 120 > 0) {
            position[2]++;
            if (position[2] >= dims[2])
                position[2] = 0;
        } else if (e.originalEvent.wheelDelta / 120 < 0) {
            position[2]--;
            if (position[2] < 0)
                position[2] = dims[2] - 1;
        }
        //updateImagesByPosition(position[2], '#mpr3');
        console.log(position.join());
    });

    ["mousedown", "mouseup", "mousemove"].forEach(function (name) {
        jQuery('#mpr1').on(name, mouseEvents);
        jQuery('#mpr2').on(name, mouseEvents);
        jQuery('#mpr3').on(name, mouseEvents);
    });
    jQuery('#mpr1').on('dragstart', function (e) { e.preventDefault(); });
    jQuery('#mpr2').on('dragstart', function (e) { e.preventDefault(); });
    jQuery('#mpr3').on('dragstart', function (e) { e.preventDefault(); });
    jQuery('#mpr1').on('swipeup', function (e) { e.preventDefault(); });
    jQuery('#mpr2').on('swipeup', function (e) { e.preventDefault(); });
    jQuery('#mpr3').on('swipeup', function (e) { e.preventDefault(); });
    jQuery('#mpr1').on('swipedown', function (e) { e.preventDefault(); });
    jQuery('#mpr2').on('swipedown', function (e) { e.preventDefault(); });
    jQuery('#mpr3').on('swipedown', function (e) { e.preventDefault(); });
    jQuery('#mpr1_overlay').on('dragstart', function (e) { e.preventDefault(); });
    jQuery('#mpr2_overlay').on('dragstart', function (e) { e.preventDefault(); });
    jQuery('#mpr3_overlay').on('dragstart', function (e) { e.preventDefault(); });
    jQuery('#mpr1_overlay').on('swipeup', function (e) { e.preventDefault(); });
    jQuery('#mpr2_overlay').on('swipeup', function (e) { e.preventDefault(); });
    jQuery('#mpr3_overlay').on('swipeup', function (e) { e.preventDefault(); });
    jQuery('#mpr1_overlay').on('swipedown', function (e) { e.preventDefault(); });
    jQuery('#mpr2_overlay').on('swipedown', function (e) { e.preventDefault(); });
    jQuery('#mpr3_overlay').on('swipedown', function (e) { e.preventDefault(); });

    // does not work because we hit the max of the buffer here
    Primary.src = "data/T1Axial.jpg"; // preload T1 image
    OverlayOrig.src = "data/T1Axial.jpg"; // preload the overlay - here the same, still try to use colors and fusion with threshold
    Atlas.src = "data/AtlasAxial.png"; // we need 16bit to index all regions of interest

    jQuery('#mpr1_message1').text("Loading data for primary... ");
    jQuery('#mpr1_message2').text("Loading data for overlay... ");

    console.log("check if images are loaded...");
    Primary.onload = function () {
        console.log("loading of T1 cache canvas is finished");
        primary_loaded = true;
        draw(); // start our render loop
    };

    OverlayOrig.onload = function () {
        if (overlay_loaded)
            return;
        // We need a new canvas for the processing of the overlay - this is very slow and
        // is not done online - for now. A web-worker would be nice.
        var canvas = document.createElement("canvas");
        canvas.width = OverlayOrig.width;
        canvas.height = OverlayOrig.height;
        var context = canvas.getContext("2d");
        context.drawImage(OverlayOrig, 0, 0);
        var overlay_image_data = context.getImageData(0, 0, OverlayOrig.width, OverlayOrig.height);
        // apply the transfer function now
        var threshold = 80;
        // this is slow because we access every pixel in the whole volume
        for (var i = 0; i < OverlayOrig.width * OverlayOrig.height * 4; i += 4) {
            if (overlay_image_data.data[i] < threshold)
                overlay_image_data.data[i + 3] = 0;
            else {
                var idx = Math.floor((overlay_image_data.data[i] - threshold) / (255 - threshold) * 255);
                overlay_image_data.data[i + 3] = 255;
                // lets use a colormap entry
                overlay_image_data.data[i + 0] = 255 * autumn[idx][0];
                overlay_image_data.data[i + 1] = 255 * autumn[idx][1];
                overlay_image_data.data[i + 2] = 255 * autumn[idx][2];
            }
        }
        context.putImageData(overlay_image_data, 0, 0);
        // from that context canvas we can create a new image that we can use with drawImage
        var url = canvas.toDataURL();
        Overlay.src = url;
        Overlay.onload = function () {
            overlay_loaded = true;
            console.log("processing of overlay cache for canvas is finished");
        };
        console.log("loading of overlay cache for canvas is finished");

    };

    Atlas.onload = function () {
        var regions = {};
        var map = {
            1: "ROI01",
            2: "ROI02",
            3: "ROI03"
        };

        if (typeof (atlas_w) == "undefined") {
            atlas_w = new Worker("js/atlas_worker.js");
        }
        if (atlas_w) {
            atlas_w.onmessage = function (event) {
                if (event.data['action'] == "message")
                    console.log("Got an event from the atlas worker: " + event.data["text"]);
                if (typeof event.data['result'] !== 'undefined') {
                    // we got our regions of interest now
                    atlas_outlines = event.data['result'];
                }
            }
            var canvas = document.createElement("canvas");
            canvas.width = Atlas.width;
            canvas.height = Atlas.height;
            var context = canvas.getContext("2d");
            context.drawImage(Atlas, 0, 0); // why do we have to do this in the main thread?
            var atlas_image_data = context.getImageData(0, 0, Atlas.width, Atlas.height);
            var start = [0, 0];
            var end = [Atlas.width, Atlas.height];

            atlas_w.postMessage({ "pixels": atlas_image_data, "start": start, "end": end, "dims": [dims[0], dims[1]] });
        }
    };
});

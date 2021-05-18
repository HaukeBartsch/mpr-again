const mouse = { x: 0, y: 0, button: false, wheel: 0, lastX: 0, lastY: 0, drag: false, dragx: 0, dragy: 0 };

// We can enable themes, ways to adjust the display for specific
// purposes. Here is a print theme that provides larger line width.
var themes = {
	"normal": {
		"primary": {
			"show": true
		},
		"overlay": {
			"show": true,
            "colormap": { 
                "max": 0.8,
                "blank_out": 0,
                "gamma": 0.5
            }
		},
		"atlas": {
			"show": true,
			"label": true,
			"colorByLabel": false,
			"outlines": true,
			"outline_width": 1,
			"outline_color": "#fff",
            "prob_threshold": 0.7,
            "simplify_error": 0.3
        }
	}, // no change
	"print": {
		"primary": {
			"show": false
		},
		"overlay": {
			"show": true,
            "colormap": { 
                "max": 0.8,
                "blank_out": 0,
                "gamma":  0.5
            }
		},
		"atlas": {
			"show": true,
			"label": false,
			"outlines": true,
			"outline_width": 5,
			"outline_color": "#fff",
			"colorByLabel": false,
            "prob_threshold": 0.7,
            "simplify_error": 0.3
		}
	}
};
// current theme is the normal theme
var theme = themes.normal;

const ctx1 = jQuery('#mpr1')[0].getContext("2d");
const ctx1_overlay = jQuery('#mpr1_overlay')[0].getContext("2d");
const ctx1_atlas = jQuery('#mpr1_atlas')[0].getContext("2d");

// AXIAL IMAGE
// real height and width of cache mosaic (we want to keep only 200x200x260 as resolution not 256x256x256)
var imageWidth = 3000; // 4096; // 11776; // 40 images // 17 images
var imageHeight = 3900; // 4096; // 11776; // 41 images // 17 images

//var dims = [512, 512, 512];
var dims = [200, 200, 260];
var numImagesX = Math.floor(imageWidth / dims[1]);
var numImagesY = Math.floor(imageHeight / dims[2]);
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
    if (primary_loaded && theme.primary.show)
        updateMPRPrimary();
    if (overlay_loaded && theme.overlay.show)
        updateMPROverlay();
    if (atlas_outlines && theme.atlas.show)
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
    if (typeof(atlas_outlines[pos]) === 'undefined' || atlas_outlines[pos].length < 1)
        return;
    
    if (requireNewDraw_atlas) {
        
        requireNewDraw_atlas = false;
        
        var canvas = jQuery('#mpr1_atlas')[0];
        //ctx1_atlas.clearRect(0, 0, canvas.width, canvas.height);
        
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
        var offsetX = 0; //dims[0] * idxx;
        var offsetY = 0; //dims[1] * idxy;
        jQuery('#mpr1_atlas2').children().remove(); // clear for the next slice, TODO: copy and cache?
        var draw = SVG('mpr1_atlas2').size(width, height).viewbox(0, 0, width, height);
        if (typeof atlas_outlines[pos] != 'undefined') {
            // draw these points
            // the slice is [pos] and inside we have a key which is the color
            var label = Object.keys(atlas_outlines[pos]);
            //console.log("label: " + label);
            for (var lab = 0; lab < label.length; lab++) {
                var color = '#fff';
                var label_name = "";
                var label_short = "";
                var label_position = [];
                var label_area = 0.0;
                var label_hole = false;

                if (typeof(atlas_colors[label[lab]]) !== 'undefined' && theme.atlas.useColorByLabel) {
                	color = "rgb(" + atlas_colors[label[lab]][1] + "," + atlas_colors[label[lab]][2] + "," + atlas_colors[label[lab]][3] + ")";
                } else {
                	color = theme.atlas.outline_color;
                }
                var dd = atlas_outlines[pos][label[lab]];
            	dd.forEach(function(d, idx) {
            				if (typeof(atlas_outlines_labels[pos][label[lab]]) !== 'undefined') {
            					label_name = atlas_outlines_labels[pos][label[lab]][idx].name;
            					label_short = label_name.replace(/[^A-Z0-9]/g, '');
            					label_position = atlas_outlines_labels[pos][label[lab]][idx].centroid;
            					label_area = atlas_outlines_labels[pos][label[lab]][idx].area;
            					label_hole = atlas_outlines_labels[pos][label[lab]][idx].hole;
            				}
                    //ctx1_atlas.fillStyle = "#999911";
            		var p = "";
            		for (var point = 0; point < d.length; point++) {
            			var x = d[point][0] - offsetX;
            			var y = d[point][1] - offsetY;
                        x = offset[0] + scale[0] * (x / dims[1] * width);
                        y = offset[1] + scale[1] * (y / dims[2] * height);
                        if (p == "") {
                        	p = "m " + x.toFixed(2) + "," + y.toFixed(2) + " ";
                        } else {
                        	p += "L" + x.toFixed(2) + "," + y.toFixed(2) + " ";
                        }
                        //ctx1_atlas.fillRect(x, y, .5, .5);
                    }
                    if (theme.atlas.outlines) {
                        var path = draw.path(p + "Z");
                        path.fill('none').stroke({
                            width: theme.atlas.outline_width + 2,
                            	color: 'rgba(0,0,0,0.8)' // background color always black????
                        });
                        var path2 = draw.path(p + "Z");
                        path2.fill('none').stroke({
                            width: theme.atlas.outline_width,
                            color: color
                        });
                    }
                    if (theme.atlas.label && label_short != "" && label_area > 10 && !label_hole) {
                    	var x = label_position[0] - offsetX;
                    	var y = label_position[1] - offsetY;
                    	x = offset[0] + scale[0] * (x / dims[1] * width);
                    	y = offset[1] + scale[1] * (y / dims[2] * height);

                    	var text = draw.plain(label_short).font({
                    		family: 'Helvetica',
                    		size: 9,
                    		anchor: "middle",
                    		fill: "#000",
                    		weight: 900
                    	}).attr({
                    		x: x,
                    		y: y
                    	});


                    	var text = draw.plain(label_short).font({
                    		family: 'Helvetica',
                    		size: 9,
                    		anchor: "middle",
                    		fill: "#ffffff",
                    		weight: 400
                    	}).attr({
                    		x: x,
                    		y: y,
                    		title: label_name,
                    		class: "text_label"
                    	});
                    	(function(label_name) {
                    		text.on("mouseover", function() {
                    			jQuery('#mpr1_message3').text(label_name);
                    		});
                    	})(label_name);
                    }
                    //path2.text("HA");
                });
            }
        }
        last_position_atlas = [position[0], position[1], position[2]];
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
        
        //3ctx1.filter = "brightness(150%)"; // we can adjust brightness and contrast using filter
        ctx1.drawImage(Primary, 
            idxy * dims[1], 
            idxx * dims[2], 
            dims[1], 
            dims[2], 
            offset[0],
            offset[1],
            scale[0] * width, 
            scale[1] * height);
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
            idxy * dims[1], 
            idxx * dims[2], 
            dims[1], 
            dims[2], 
            offset[0], 
            offset[1], 
            scale[0] * width, 
            scale[1] * height);
        
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
    } else if (e.type === "mousemove" && !mouse.button) {
        // just show the value of beta-hat at this location
        const bounds = jQuery(mpr)[0].getBoundingClientRect();
        var p = [e.pageX - bounds.left, e.pageY - bounds.top]; // I should be inside the picture, how to scale?
        var canvas = jQuery('#mpr1_overlay')[0];
        var width = canvas.width;
        var height = canvas.height;
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
        // our p is in after scale coordinates, we would like to undo to get
        // the pixel coordinates instead
        p[0] = Math.floor(((p[0] - offset[0])/scale[0])/width*dims[1]);
        p[1] = Math.floor(((p[1] - offset[1])/scale[1])/height*dims[2]);
        var os = position[0] * (dims[1] * dims[2]);
        // this is not correct yet. Our OverlayRawData is structured like a large image.
        // jQuery('#mpr1_message1').text("mouse position at: " + JSON.stringify(p) + " is: " + OverlayRawData[os + p[1]*dims[1] + p[0]].toFixed(4));
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
    var svg_atlas = jQuery('#mpr1_atlas2')[0];
    svg_atlas.width = jQuery('#mpr1_atlas2').width();
    svg_atlas.height = jQuery('#mpr1_atlas2').height();
}

function makeRequest (method, url) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.responseType = 'arraybuffer';

      xhr.onload = function (e) {
        if (this.status >= 200 && this.status < 300) {
            console.log("got status change");
            resolve(xhr.response);
        } else {
          reject({
            status: this.status,
            statusText: xhr.statusText
          });
        }
      };
      xhr.onerror = function () {
        reject({
          status: this.status,
          statusText: xhr.statusText
        });
      };
      xhr.send();
    });
}

// get a webASEG.json and webASEG folder from the harddrive (created by Matlab)
function readWebASEG(json_filename, callback) {
    var p = json_filename.split(/\//g); p.pop(); var path = p.join('/');
    jQuery.getJSON(json_filename, function(data) {
        var viewIndices;
        var viewProbs;
        // we need to pull data.indices and data.probs as raw data
        makeRequest('GET', path + "/" + data.indices)
        .then(function(indices) {
            viewIndices = new Uint32Array(indices);
            //console.log("got the indices..." + viewIndices.length);
            return makeRequest('GET', path + "/" + data.probs);
        })
        .then(function(probs) {
            viewProbs = new Float32Array(probs);
            //console.log("got the probs..." + viewProbs.length);
            data.viewIndices = viewIndices;
            data.viewProbs = viewProbs;
            callback(data, viewIndices, viewProbs);
        })
    });
}

function readOverlayRawFile(overlay_raw_data_path, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', overlay_raw_data_path, true);
    xhr.responseType = 'arraybuffer';
    
    xhr.onload = function(e) {
      if (this.status == 200) {
        // get an array buffer
        var b = e.target.response;
        let view = new  Float32Array(b);
        //alert(view.length); // ok should be 3000x3900 float values that can be indexed
        callback(view);
      }
    };
    
    xhr.send();
}

// copy the content of the webASEG with a given threshold into AtlasImage16bit
function copyWebASEG(webASEG, AtlasImage16bit, threshold, start, end, dims) {
    for (var i = 0; i < AtlasImage16bit.size; i++) {
        AtlasImage16bit.data[i] = 0;
    }
    var w = AtlasImage16bit.width;
    var h = AtlasImage16bit.height;
    var numImX = Math.floor(w / dims[1]);
    var numImY = Math.floor(h / dims[2]);

    // make two loops, one to create a full volume
    var buf = new Uint32Array(dims[0]*dims[1]*dims[2]);
    var bufHighestProb = new Float32Array(dims[0]*dims[1]*dims[2]);
    for (var i = 0; i < webASEG.viewIndices.length; i++) {
        // what region of interest and what pixel position?
        // whole volume is 200x200x260x45
        var idx = webASEG.viewIndices[i];
        // which region of interest volume is this?
        var ROI = Math.floor(idx / (dims[0]*dims[1]*dims[2]));
        var label = webASEG.roicodes[ROI];
        if (label == 0)
            continue; // we don't need to do anything for the 0 label, its zero already
        var name = webASEG.roinames[ROI];
        // get the index without the offset due to labels
        idx = idx - (ROI * (dims[0]*dims[1]*dims[2]));

        if (webASEG.viewProbs[i] < threshold) {
            buf[idx] = 0;
        } else {
            // only mark this voxel as label if there is not already a higher prob label at this location
            if (bufHighestProb[idx] < webASEG.viewProbs[i]) {
                buf[idx] = label;
                bufHighestProb[idx] = webASEG.viewProbs[i];
            }
        }
    }
    // print to screen, looks ok (coronal section)
    if (false) {
        for (var y = 0; y < dims[2]; y++) {
            var line = "";
            for (var x = 0; x < dims[1]; x++) {
                var idx = y * (dims[1]*dims[0]) + x*dims[0] + Math.floor(dims[0]/2);
                if (buf[idx] > 0)
                    line = line + "x";
                else
                    line = line + " ";
            }
            console.log(line);
        }
    }

    // one to copy the full volume over to the AtlasImage16bit in mosaic format
    for (var slice = 0; slice < dims[0]; slice++) { // axial?
        // now fill in values from buf into AtlasImage16bit.data
        var x = Math.floor(slice / numImX); // offset
        var y = slice - (x * numImX);
        for (var j = 0; j < dims[2]; j++) {
            for (var i = 0; i < dims[1]; i++) {
                idx = ((dims[2]-j-1) * (dims[1]*dims[0])) + (i*dims[0]) + slice;
                var offsetIdx = (y * dims[2] * w) + (j * w) + (x * dims[1]);
                idx2 = offsetIdx + i;
                AtlasImage16bit.data[idx2] = buf[idx];
                // help by coloring the borders
                //if (i > (dims[1]-2))
                //    AtlasImage16bit.data[idx2] = 200;
                //if (j > (dims[2]-2))
                //    AtlasImage16bit.data[idx2] = 200;
            }
        }
    }
    // show the image in AtlasImage16bit in the debug canvas
    if (false) {
        function setPixel(imageData, x, y, r, g, b, a){
            var index = x + (y * Math.round(imageData.width));
            imageData.data[index * 4 + 0] = r;
            imageData.data[index * 4 + 1] = g;
            imageData.data[index * 4 + 2] = b;
            imageData.data[index * 4 + 3] = a;
        }
        jQuery('#debug').width(w);
        jQuery('#debug').height(h);
        var canvas = jQuery('#debug')[0];
        //var ctx = canvas.getContext("2d");

        var imageData = canvas.getContext("2d").getImageData(0, 0, canvas.clientWidth, canvas.clientHeight);
        //var imageData = canvas.getContext("2d").createImageData(canvas.clientWidth, canvas.clientHeight);
        var idx = 0;
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {       
                var idx = y*w + x;  
                var intensity = AtlasImage16bit.data[idx];
                if (intensity > 0) {
                    intensity *= 4;
                    if (intensity > 255)
                        intensity = 255;
                }
                //intensity = 255;
                //idx = idx + 1;
                setPixel(imageData, x, y, intensity, intensity, intensity, 255);
                //if (Math.round(x/8) % 200 == 0 || Math.round(y/8) % 260 == 0)
                //   setPixel(imageData, Math.round(x/8), Math.round(y/8), 255, 255, 255, 255);
            }
        }
        canvas.getContext("2d").putImageData(imageData, 0, 0);
        // and download the image

        var link = document.createElement('a');
        link.download = 'snapshot.png';
        link.href = document.getElementById('debug').toDataURL();
        link.click();
        jQuery('#debug').hide();
    }
}


var atlas_w; // the web-worker that will compute the regions of interest in atlas space
var atlas_w2; // web-worker for webASEG
var AtlasImage16bit;
var atlas_webASEG;
var OverlayRawData; // store the raw beta-hat values here
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
        //console.log(position.join());
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
        //console.log(position.join());
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
        //console.log(position.join());
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
    Primary.src = "data/Atlas/T1AtlasAxial.jpg"; // preload T1 image
    //OverlayOrig.src = "data/Atlas/ND_beta_hatAxial_01_256_256_256_single.dat.gz"; // preload the overlay - here the same, still try to use colors and fusion with threshold
    overlay_raw_data_path = "data/Atlas/ND_beta_hatAxial_08_200_200_260_single.dat";
    //Atlas.src = "data/AtlasAxial.png"; // we need 16bit to index all regions of interest44
    
    readWebASEG('data/Atlas/webASEG.json', function(data) {
        atlas_webASEG = data;
        //console.log("DONE reading webASEG"); 
        // given a threshold we can create a volume of labels
        var threshold = theme.atlas.prob_threshold;
        var accuracy = theme.atlas.simplify_error; // how accurate is the outline? Error allowed after simplifying polygon
        // we should stuff this into an image (the label as unsigned short)
               
        // instead of using the FreeSurfer colors in atlas_colors, we need to create our own 
        // description based on the entries in data.roinames and data.roicodes
        // structure should be:
        // var atlas_colors = {
		//   "0": ["Unknown", 0, 0, 0, 0],
		//   "1": ["Left - Cerebral - Exterior", 70, 130, 180, 0],

        var local_atlas_colors = {};
        for (var i = 0; i < data.roicodes.length; i++) {
            local_atlas_colors[data.roicodes[i]] = [ data.roinames[i], 255,255,255,0 ];
        }

        if (typeof (atlas_w2) == "undefined") {
            atlas_w2 = new Worker("js/atlas_worker2.js");
        }
        if (atlas_w2) {
            atlas_w2.onmessage = function (event) {
                if (event.data['action'] == "message") {
                    if (typeof(event.data["text"]) != "undefined")
                       console.log("Got an event from the atlas worker: " + event.data["text"]);
                }
                if (event.data['action'] == "OpenCVReady") {
                    async function loadAtlas() {
                        // todo: We don't need to read an image here. Would be sufficient to just
                        // create it here.
                        let AtlasImage16bit = await IJS.Image.load("data/AtlasAxial.png");
                        var start = [0, 0];
                        var end = [Primary.width, Primary.height]; // should be 3000, 3900
                        copyWebASEG(atlas_webASEG, AtlasImage16bit, threshold, start, end, dims);
                        atlas_w2.postMessage({
                            "pixels16bit": AtlasImage16bit, // target for the the image
                            "atlas_colors": local_atlas_colors,
                            "start": start,
                            "end": end,
                            "dims": [dims[1], dims[2]],
                            "accuracy": accuracy
                        });
                        return AtlasImage16bit;
                    };
                    AtlasImage16bit = loadAtlas().catch(console.error);
                }
                if (typeof(event.data["result"]) !== "undefined") {
                	atlas_outlines = [];
                	atlas_outlines_labels = [];
                	var keys = Object.keys(event.data["result"]);
                	for (var i = 0; i < keys.length; i++) {
                		atlas_outlines[keys[i]] = event.data["result"][keys[i]]["contour_array"];
                		atlas_outlines_labels[keys[i]] = event.data["result"][keys[i]]["label_array"];
                	}
                	console.log("received the atlas outlines and the atlas labels...");
                } // end of onmessage
            };
        }

    });


    jQuery('#mpr1_message1').text("Loading data for primary... ");
    jQuery('#mpr1_message2').text("Loading data for overlay... ");
    
    console.log("check if images are loaded...");
    Primary.onload = function () {
        console.log("loading of T1 cache canvas is finished");
        primary_loaded = true;
        draw(); // start our render loop
    };
    
    readOverlayRawFile(overlay_raw_data_path, function(arrayBufferView) {
        // ok we have the data loaded now lets add them to the overlay_image_data
        if (overlay_loaded)
            return;

        OverlayRawData = arrayBufferView;
        
        // maybe we don't have OverlayOrig yet, we should create such an image???
        var OverlayOrig = new Image(3000,3900);

        // We need a new canvas for the processing of the overlay - this is very slow and
        // is not done online - for now. A web-worker would be nice.
        var canvas = document.createElement("canvas");
        canvas.width  = OverlayOrig.width;  // this is 4096
        canvas.height = OverlayOrig.height; // this 4096
        var context = canvas.getContext("2d");
        // where is OverlayOrig comming from?
        context.drawImage(OverlayOrig, 0, 0); // nothing in there yet
        var overlay_image_data = context.getImageData(0, 0, OverlayOrig.width, OverlayOrig.height);
        // apply the transfer function now
        var minV = 0; var maxV = 0;
        for (var i = 0; i < OverlayOrig.width * OverlayOrig.height; i++) {
            if (minV > arrayBufferView[i])
                minV =  arrayBufferView[i];
            if (maxV < arrayBufferView[i])
                maxV = arrayBufferView[i];
        }
        var symMax = Math.max(Math.abs(minV), Math.abs(maxV)); // could be all negative!
        if (typeof (theme.overlay.colormap.max) != 'undefined')
            symMax = theme.overlay.colormap.max;

        // this is slow because we access every pixel in the whole volume
        var threshold = 0;//symMax/20; // plus/minus (beta, mask)
        if (typeof (theme.overlay.colormap.blank_out) != 'undefined')
            threshold = theme.overlay.colormap.blank_out;

        var exponent = 0.5; // change the transparency to make it more easier to see
        if (typeof (theme.overlay.colormap.gamma) != 'undefined')
            exponent = theme.overlay.colormap.gamma;

        console.log("Overlay: range is -" + symMax.toFixed(3) + ".." + symMax.toFixed(3));

        var middle = Math.floor(redblackblue.length/2);
        for (var y = 0; y < OverlayOrig.height; y++) {
            for (var x = 0; x < OverlayOrig.width; x++) {
                var i = y * OverlayOrig.width + x;
                //var j = y * OverlayOrig.width + x;
                
                if (Math.abs(arrayBufferView[i]) < threshold) {
                    overlay_image_data.data[i*4 + 3] = 0;
                } else {
                    //var idx = middle + Math.floor((arrayBufferView[i] - threshold) / (symMax*2.0 -  threshold) * middle);
                    var idx = middle + Math.round( (arrayBufferView[i] / symMax) * middle);
                    // switch the colormap around (red should be positive)
                    idx = middle - (idx - middle);
                    var opacity = Math.pow(Math.abs(arrayBufferView[i] / symMax), exponent);
                    overlay_image_data.data[i*4 + 3] = opacity * 255; // Math.max(0, Math.min(2*Math.pow(Math.abs(idx - middle),exponent),255));
                    // lets use a colormap entry
                    //if (typeof(redblackblue[idx]) == 'undefined')
                    //    console.log("ERROR")
                    // use clamping
                    idx = Math.max(0, Math.min(idx, redblackblue.length));
                    overlay_image_data.data[i*4 + 0] = 255 * redblackblue[idx][0];
                    overlay_image_data.data[i*4 + 1] = 255 * redblackblue[idx][1];
                    overlay_image_data.data[i*4 + 2] = 255 * redblackblue[idx][2];
                }
            }
        }
        //for (var i = 0; i < OverlayOrig.width * OverlayOrig.height; i++) {
        //}
        context.putImageData(overlay_image_data, 0, 0);
        // from that context canvas we can create a new image that we can use with drawImage
        var url = canvas.toDataURL();
        Overlay.src = url;
        Overlay.onload = function () {
            overlay_loaded = true;
            console.log("processing of overlay cache for canvas is finished");
        };
        console.log("loading of overlay cache for canvas is finished");
    });

    // don't use for raw data
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
        var threshold = 90;
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
    
/*    Atlas.onload = function () {
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
                if (event.data['action'] == "message") {
                    if (typeof(event.data["text"]) != "undefined")
                       console.log("Got an event from the atlas worker: " + event.data["text"]);
                }
                // read a 16bit version of the data (single channel)
                if (event.data['action'] == "OpenCVReady") {
                	async function loadAtlas() {
                			let AtlasImage16bit = await IJS.Image.load("data/AtlasAxial.png");
                			var start = [0, 0];
                			var end = [Atlas.width, Atlas.height];
                			atlas_w.postMessage({
                                "pixels16bit": AtlasImage16bit,
                                "atlas_colors": atlas_colors,
                				"start": start,
                				"end": end,
                				"dims": [dims[0], dims[1]]
                			});
                			return AtlasImage16bit;
                    }
                    AtlasImage16bit = loadAtlas().catch(console.error);
                }
                if (typeof(event.data["result"]) !== "undefined") {
                	atlas_outlines = [];
                	atlas_outlines_labels = [];
                	var keys = Object.keys(event.data["result"]);
                	for (var i = 0; i < keys.length; i++) {
                		atlas_outlines[keys[i]] = event.data["result"][keys[i]]["contour_array"];
                		atlas_outlines_labels[keys[i]] = event.data["result"][keys[i]]["label_array"];
                	}
                	console.log("received the atlas outlines and the atlas labels...");
                } // end of onmessage
            };
        }
    }; */
    jQuery(document).on('keydown', function(e) {
        if (e.which == 49) {
            theme.atlas.useColorByLabel = !theme.atlas.useColorByLabel;
        }
        if (e.which == 50) { // 2
            if (jQuery('#mpr1_overlay').is(":visible"))
            jQuery('#mpr1_overlay').hide();
            else
            jQuery('#mpr1_overlay').show();
        }
        if (e.which == 51) {
            if (jQuery('#mpr1_atlas2').is(":visible"))
            jQuery('#mpr1_atlas2').hide();
            else
            jQuery('#mpr1_atlas2').show();
        }
        if (e.which == 52) {
            if (jQuery('#mpr1').is(":visible"))
            jQuery('#mpr1').hide();
            else
            jQuery('#mpr1').show();
        }
        if (e.which == 84) { // 't'
        	// do some timing of the rendering, we want to draw as fast as we can
        	position[0] = 0;
        	// force a redraw of all
        	requireNewDraw_atlas = true;
        	requireNewDraw_overlay = true;
        	requireNewDraw = true;
        	var start = new Date().getTime();

        	function tim() {
        		var stopTiming = false;
        		if (!requireNewDraw && !requireNewDraw_overlay && !requireNewDraw_atlas) {
        			if (position[0] >= dims[0]) {
        				var end = new Date().getTime();
        				var t = (end - start);
        				var tt = "Rendering Time: " + t + "ms for " +
        					dims[0] + " slices [" + ((dims[0] / t) * 1000.0).toFixed(0) + " slices/sec].";
        				setTimeout(function() {
        					jQuery('#mpr1_message3').text(tt);
        				}, 100);
        				console.log(tt);
        				stopTiming = true;
        			}
        			if (position[0] <= dims[0]) {
        				position[0]++;
        			}
        		}
        		if (!stopTiming)
        			setTimeout(tim, 1);
        	}
        	setTimeout(tim, 1);
        }
    }); 
});

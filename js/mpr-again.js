// library for a single MPR viewer

class MPR_AGAIN {
    mouse = {
        x: 0,
        	y: 0,
        	button: false,
        	wheel: 0,
        	lastX: 0,
        	lastY: 0,
        	drag: false,
        	dragx: 0,
        	dragy: 0
    };

    static themes = {
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
        		"prob_threshold": 0.9,
        		"simplify_error": 0.01
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
        			"gamma": 0.5
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
        		"simplify_error": 0.01
        	}
        }
    };
    theme = MPR_AGAIN.themes["normal"];

    //ctx1 = jQuery('#mpr1')[0].getContext("2d");
    //ctx1_overlay = jQuery('#mpr1_overlay')[0].getContext("2d");
    //ctx1_atlas = jQuery('#mpr1_atlas')[0].getContext("2d");
    ctx1;
    ctx1_overlay;
    ctx1_atlas;

    imageWidth = 3000; // 4096; // 11776; // 40 images // 17 images
    imageHeight = 3900; // 4096; // 11776; // 41 images // 17 images

    dims = [200, 200, 260];
    viewIndex = [1, 2]; // for axial index into dimensions
    numImagesX; //  = Math.floor(imageWidth / dims[1]);
    numImagesY; //  = Math.floor(imageHeight / dims[2]);
    sliceDirection = +1; // the direction we slice from (flip if -1)
    // has to be set by the calling function
    position = function() {
        return [0, 0, 0];
    }

    Primary = new Image();
    OverlayOrig = new Image(); // the original overlay before processing
    Overlay = new Image(); // the overlay after processing
    OverlayRawData;

    Atlas = new Image();
    t1_buffer_ctx;
    t1_canvas;
    atlas_outlines;

    primary_loaded = false;
    overlay_loaded = false;
    previous_timestamp;
    atlas_w; // the web-worker that will compute the regions of interest in atlas space
    atlas_w2; // web-worker for webASEG
    AtlasImage16bit;
    atlas_webASEG;
    drawMPR(timestamp) {
        if (this.primary_loaded && this.theme.primary.show) {
        	this.updateMPRPrimary();
        }
        if (this.overlay_loaded && this.theme.overlay.show) {
        	this.updateMPROverlay();
        }
        if (this.atlas_outlines && this.theme.atlas.show) {
            this.updateAtlasOverlays();
            }
            requestAnimationFrame(function(self) {
            	return self.drawMPR.bind(self);
            }(this));
    }

    last_position; // cache this to make animation requests faster
    last_position_overlay; // cache this to make animation requests faster
    requireNewDraw = false;
    requireNewDraw_overlay = false;
    // we have three MPRs that we need to compute
    updateMPRPrimary() {
        position = this.position();
        var sliceDim = 0;
        if (0 != this.viewIndex[0] && 0 != this.viewIndex[1]) {
        	sliceDim = 0;
        }
        if (1 != this.viewIndex[0] && 1 != this.viewIndex[1]) {
        	sliceDim = 1;
        }
        if (2 != this.viewIndex[0] && 2 != this.viewIndex[1]) {
        	sliceDim = 2;
        }

        if (typeof this.last_position == 'undefined' || (this.last_position[0] != position[0] || this.last_position[1] != position[1] || this.last_position[2] != position[2])) {
        	this.requireNewDraw = true;
        }
        if (this.requireNewDraw) {
        	var startTime = (new Date()).getTime();

        	this.requireNewDraw = false;
        	var idxy = Math.floor(position[sliceDim] / this.numImagesX);
        	var idxx = position[sliceDim] - (idxy * this.numImagesX);
        	var canvas = jQuery(this.primary)[0];

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
        	this.ctx1.drawImage(this.Primary,
        		idxy * this.dims[this.viewIndex[0]],
        		idxx * this.dims[this.viewIndex[1]],
        		this.dims[this.viewIndex[0]],
        		this.dims[this.viewIndex[1]],
        		offset[0],
        		offset[1],
        		scale[0] * width,
        		scale[1] * height);

        	var perc = [
        		((position[0] / (this.dims[0] - 1))),
        		((position[1] / (this.dims[1] - 1))),
        		((position[2] / (this.dims[2] - 1)))
        	];
        	if (this.sliceDirection == -1) {
        		perc[0] = 1 - perc[0];
        		perc[1] = 1 - perc[1];
        		perc[2] = 1 - perc[2];
        	}

        	var crosshair_horz = jQuery(this.primary).parent().find('.crosshair-horizontal');
        	jQuery(crosshair_horz).css('top', (offset[1] + (perc[this.viewIndex[1]] * scale[1] * height)) + "px");
        	var crosshair_vert = jQuery(this.primary).parent().find('.crosshair-vertical');
        	jQuery(crosshair_vert).css('left', (offset[0] + (perc[this.viewIndex[0]] * scale[0] * width)) + "px");

        	//console.log("Did draw now update last_position");
        	this.last_position = [position[0], position[1], position[2]];

        	var pos = position[sliceDim];
        	var orient = "axial";
        	if (sliceDim == 0) {
        		orient = "axial";
        	} else if (sliceDim == 1) {
        		orient = "sagittal";
        	} else if (sliceDim == 2) {
        		orient = "coronal";
        	}
        	jQuery(this.message1).text(orient + " slice: " + pos + " [" + ((new Date()).getTime() - startTime) + "ms]");
        	jQuery(this.message3).text(position.join(", "));
            }
        }

        updateMPROverlay() {
        		position = this.position();
        		var sliceDim = 0;
        		if (0 != this.viewIndex[0] && 0 != this.viewIndex[1]) {
        			sliceDim = 0;
        		}
        		if (1 != this.viewIndex[0] && 1 != this.viewIndex[1]) {
        			sliceDim = 1;
        		}
        		if (2 != this.viewIndex[0] && 2 != this.viewIndex[1]) {
        			sliceDim = 2;
        		}

        	if (typeof this.last_position_overlay == 'undefined' || (this.last_position_overlay[0] != position[0] || this.last_position_overlay[1] != position[1] || this.last_position_overlay[2] != position[2])) {
        		this.requireNewDraw_overlay = true;
        	}
        	if (this.requireNewDraw_overlay) {
        		startTime = (new Date()).getTime();

        		this.requireNewDraw_overlay = false;
        		var idxy = Math.floor(position[sliceDim] / this.numImagesX);
        		var idxx = position[sliceDim] - (idxy * this.numImagesX);
        		var canvas = jQuery(this.overlay)[0];
        		this.ctx1_overlay.clearRect(0, 0, canvas.width, canvas.height);

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

        		this.ctx1_overlay.drawImage(this.Overlay,
        			idxy * this.dims[this.viewIndex[0]],
        			idxx * this.dims[this.viewIndex[1]],
        			this.dims[this.viewIndex[0]],
        			this.dims[this.viewIndex[1]],
        			offset[0],
        			offset[1],
        			scale[0] * width,
        			scale[1] * height);

        		//console.log("Did draw now update last_position");

        		this.last_position_overlay = [position[0], position[1], position[2]];

        		var pos = position[sliceDim];
        		var orient = "axial";
        		if (sliceDim == 0) {
        			orient = "axial";
        		} else if (sliceDim == 1) {
        			orient = "sagittal";
        		} else if (sliceDim == 2) {
        			orient = "coronal";
        		}

        		jQuery(this.message2).text("Overlay " + orient + " slice: " + pos + " [" + ((new Date()).getTime() - startTime) + "ms]");
        		}
        		}
        		last_position_atlas; // cache this to make animation requests faster
        		requireNewDraw_atlas = false;
        		updateAtlasOverlays() {
        			position = this.position();
        			var sliceDim = 0;
        			if (0 != this.viewIndex[0] && 0 != this.viewIndex[1]) {
        				sliceDim = 0;
        			}
        			if (1 != this.viewIndex[0] && 1 != this.viewIndex[1]) {
        				sliceDim = 1;
        			}
        			if (2 != this.viewIndex[0] && 2 != this.viewIndex[1]) {
        				sliceDim = 2;
        			}


        			if (typeof this.atlas_outlines == 'undefined')
        				return;

        			if (typeof this.last_position_atlas == 'undefined' || (this.last_position_atlas[0] != position[0] || this.last_position_atlas[1] != position[1] || this.last_position_atlas[2] != position[2])) {
        				this.requireNewDraw_atlas = true;
        			}

        			// just draw them as colored dots and we don't need to define any polygons
        			var pos = position[sliceDim]; // use this slice
        			if (typeof(this.atlas_outlines[pos]) === 'undefined' || this.atlas_outlines[pos].length < 1)
        				return;

        			if (this.requireNewDraw_atlas) {

        				this.requireNewDraw_atlas = false;

        				var canvas = jQuery(this.atlas)[0];
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

        				var idxy = Math.floor(position[sliceDim] / this.numImagesX);
        				var idxx = position[sliceDim] - (idxy * this.numImagesX);
        				var offsetX = 0; //dims[0] * idxx;
        				var offsetY = 0; //dims[1] * idxy;
        				jQuery(this.atlas2).children().remove(); // clear for the next slice, TODO: copy and cache?
        				var draw = SVG(this.atlas2).size(width, height).viewbox(0, 0, width, height);
        				if (typeof this.atlas_outlines[pos] != 'undefined') {
        					// draw these points
        					// the slice is [pos] and inside we have a key which is the color
        					var label = Object.keys(this.atlas_outlines[pos]);
        					//console.log("label: " + label);
        					for (var lab = 0; lab < label.length; lab++) {
        						var color = '#fff';
        						var label_name = "";
        						var label_short = "";
        						var label_position = [];
        						var label_area = 0.0;
        						var label_hole = false;

        						if (typeof(atlas_colors[label[lab]]) !== 'undefined' && this.theme.atlas.colorByLabel) {
        							color = "rgb(" + atlas_colors[label[lab]][1] + "," + atlas_colors[label[lab]][2] + "," + atlas_colors[label[lab]][3] + ")";
        						} else {
        							color = this.theme.atlas.outline_color;
        						}
        						var dd = this.atlas_outlines[pos][label[lab]];
        						dd.forEach(function(self) {
        							return function(d, idx) {
        								if (typeof(self.atlas_outlines_labels[pos][label[lab]]) !== 'undefined') {
        									label_name = self.atlas_outlines_labels[pos][label[lab]][idx].name;
        									label_short = label_name.replace(/[^A-Z0-9]/g, '');
        									label_position = self.atlas_outlines_labels[pos][label[lab]][idx].centroid;
        									label_area = self.atlas_outlines_labels[pos][label[lab]][idx].area;
        									label_hole = self.atlas_outlines_labels[pos][label[lab]][idx].hole;
        								}
        								//ctx1_atlas.fillStyle = "#999911";
        								var p = "";
        								for (var point = 0; point < d.length; point++) {
        									var x = d[point][0] - offsetX;
        									var y = d[point][1] - offsetY;
        									x = offset[0] + scale[0] * (x / self.dims[self.viewIndex[0]] * width);
        									y = offset[1] + scale[1] * (y / self.dims[self.viewIndex[1]] * height);
        									if (p == "") {
        										p = "m " + x.toFixed(2) + "," + y.toFixed(2) + " ";
        									} else {
        										p += "L" + x.toFixed(2) + "," + y.toFixed(2) + " ";
        									}
        									//ctx1_atlas.fillRect(x, y, .5, .5);
        								}
        								if (self.theme.atlas.outlines) {
        									var path = draw.path(p + "Z");
        									path.fill('none').stroke({
        										width: self.theme.atlas.outline_width + 2,
        										color: 'rgba(0,0,0,0.8)' // background color always black????
        									});
        									var path2 = draw.path(p + "Z");
        									path2.fill('none').stroke({
        										width: self.theme.atlas.outline_width,
        										color: color
        									});
        								}
        								if (self.theme.atlas.label && label_short != "" && label_area > 10 && !label_hole) {
        									var x = label_position[0] - offsetX;
        									var y = label_position[1] - offsetY;
        									x = offset[0] + scale[0] * (x / self.dims[self.viewIndex[0]] * width);
        									y = offset[1] + scale[1] * (y / self.dims[self.viewIndex[1]] * height);

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
        											jQuery(self.message3).text(label_name);
        										});
        									})(label_name);
        								}
        								//path2.text("HA");
        							};
        						}(this));
        					}
        				}
        				this.last_position_atlas = [position[0], position[1], position[2]];
        			}
        		}

            readOverlayRawFile(overlay_raw_data_path, callback) {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', overlay_raw_data_path, true);
                xhr.responseType = 'arraybuffer';
                xhr.env_for_callback = this;

                xhr.onload = function(e) {
                	if (this.status == 200) {
                		// get an array buffer
                		var b = e.target.response;
                		let view = new Float32Array(b);
                		//alert(view.length); // ok should be 3000x3900 float values that can be indexed
                		callback.bind(this.env_for_callback, view)();
                	}
                };

                xhr.send();
                }
                copyWebASEG(webASEG, AtlasImage16bit, threshold, start, end, dims) {
                    position = this.position();
                    var sliceDim = 0;
                    if (0 != this.viewIndex[0] && 0 != this.viewIndex[1]) {
                    	sliceDim = 0;
                    }
                    if (1 != this.viewIndex[0] && 1 != this.viewIndex[1]) {
                    	sliceDim = 1;
                    }
                    if (2 != this.viewIndex[0] && 2 != this.viewIndex[1]) {
                    	sliceDim = 2;
                    }

                for (var i = 0; i < AtlasImage16bit.size; i++) {
                	AtlasImage16bit.data[i] = 0;
                }
                var w = AtlasImage16bit.width;
                var h = AtlasImage16bit.height;
                var numImX = Math.floor(w / this.dims[this.viewIndex[0]]);
                var numImY = Math.floor(h / this.dims[this.viewIndex[1]]);

                // make two loops, one to create a full volume
                var buf = new Uint32Array(this.dims[0] * this.dims[1] * this.dims[2]);
                var bufHighestProb = new Float32Array(this.dims[0] * this.dims[1] * this.dims[2]);
                for (var i = 0; i < webASEG.viewIndices.length; i++) {
                	// what region of interest and what pixel position?
                	// whole volume is 200x200x260x45
                	var idx = webASEG.viewIndices[i];
                	// which region of interest volume is this?
                	var ROI = Math.floor(idx / (this.dims[0] * this.dims[1] * this.dims[2]));
                	var label = webASEG.roicodes[ROI];
                	if (label == 0)
                		continue; // we don't need to do anything for the 0 label, its zero already
                	var name = webASEG.roinames[ROI];
                	// get the index without the offset due to labels
                	idx = idx - (ROI * (this.dims[0] * this.dims[1] * this.dims[2]));

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
                				var idx = y * (dims[1] * dims[0]) + x * dims[0] + Math.floor(dims[0] / 2);
                				if (buf[idx] > 0)
                					line = line + "x";
                				else
                					line = line + " ";
                			}
                			console.log(line);
                		}
                	}

                // one to copy the full volume over to the AtlasImage16bit in mosaic format
                for (var slice = 0; slice < dims[sliceDim]; slice++) { // axial?
                	// now fill in values from buf into AtlasImage16bit.data
                	var x = Math.floor(slice / numImX); // offset
                	var y = slice - (x * numImX);
                	for (var j = 0; j < this.dims[this.viewIndex[1]]; j++) {
                		for (var i = 0; i < this.dims[this.viewIndex[0]]; i++) {
                			idx = ((this.dims[this.viewIndex[1]] - j - 1) * (this.dims[this.viewIndex[0]] * this.dims[sliceDim])) + (i * this.dims[sliceDim]) + slice;
                			var offsetIdx = (y * this.dims[this.viewIndex[1]] * w) + (j * w) + (x * this.dims[this.viewIndex[0]]);
                			var idx2 = offsetIdx + i;
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
                		function setPixel(imageData, x, y, r, g, b, a) {
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
                			var idx = y * w + x;
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

                mouseEvents(e) {
                		var mpr = this.primary;
                		position = this.position();

                	this.mouse.button = e.type === "mousedown" ? true : e.type === "mouseup" ? false : this.mouse.button;

                	const bounds = jQuery(mpr)[0].getBoundingClientRect();

                	var sliceDim = 0;
                	if (0 != this.viewIndex[0] && 0 != this.viewIndex[1]) {
                		sliceDim = 0;
                	}
                	if (1 != this.viewIndex[0] && 1 != this.viewIndex[1]) {
                		sliceDim = 1;
                	}
                	if (2 != this.viewIndex[0] && 2 != this.viewIndex[1]) {
                		sliceDim = 2;
                	}

                	if (e.type === "mousedown" || e.type === "mouseup") {
                		//mouse.lastx = e.pageX - bounds.left - scrollX;
                		//mouse.lasty = e.pageY - bounds.top - scrollY;
                		this.mouse.lasty = e.pageY;

                		/*if (mpr === "#mpr1")
                		mouse.dragy = position[0];
                		else if (mpr === "#mpr2")
                		mouse.dragy = position[1];
                		else if (mpr === "#mpr3")
                		mouse.dragy = position[2];
                		*/
                		this.mouse.dragy = position[sliceDim];

                		e.preventDefault();
                		} else if (e.type === "mousemove" && this.mouse.button) {
                			// mousemove
                			const bounds = jQuery(mpr)[0].getBoundingClientRect();
                			//mouse.y = e.pageY - bounds.top - scrollY;
                			this.mouse.y = e.pageY;
                			var val = 0.2 * (this.mouse.y - this.mouse.lasty);
                			val = (val >= 0 || -1) * Math.floor(Math.abs(val));

                		if (isFinite(val)) {
                			/*if (mpr === '#mpr1') {
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
                			}*/
                			position[sliceDim] = this.mouse.dragy + val;
                			if (position[sliceDim] < 0)
                				position[sliceDim] = 0;
                			if (position[sliceDim] >= this.dims[sliceDim])
                				position[sliceDim] = this.dims[sliceDim] - 1;
                		}
                		e.preventDefault();
                		} else if (e.type === "mousemove" && !this.mouse.button) {
                			// just show the value of beta-hat at this location
                			const bounds = jQuery(mpr)[0].getBoundingClientRect();
                			var p = [e.pageX - bounds.left, e.pageY - bounds.top]; // I should be inside the picture, how to scale?
                			var canvas = jQuery(this.overlay)[0];
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
                			p[0] = Math.floor(((p[0] - offset[0]) / scale[0]) / width * this.dims[this.viewIndex[0]]);
                			p[1] = Math.floor(((p[1] - offset[1]) / scale[1]) / height * this.dims[this.viewIndex[1]]);
                			var os = position[sliceDim] * (this.dims[this.viewIndex[0]] * this.dims[this.viewIndex[1]]);
                			// this is not correct yet. Our OverlayRawData is structured like a large image.
                			// jQuery('#mpr1_message1').text("mouse position at: " + JSON.stringify(p) + " is: " + OverlayRawData[os + p[1]*dims[1] + p[0]].toFixed(4));
                			e.preventDefault();
                		}
                		}
                		resize() {
                				this.requireNewDraw = true; // redraw even if the position did  not change
                				this.requireNewDraw_overlay = true;
                				this.requireNewDraw_atlas = true;
                				//jQuery('.MPR').css('height', jQuery(window).height() / 2.0);

                	// set size of canvas once
                	var ov = this.overlay; // "#" + two2ds[i] + "_overlay";
                	var at = this.atlas; // "#" + two2ds[i] + "_atlas";
                	var pu = this.primary; // "#" + two2ds[i];
                	if (jQuery(ov).length > 0) {
                		var canvas = jQuery(ov)[0];
                		canvas.width = jQuery(ov).width();
                		canvas.height = jQuery(ov).height();
                	}
                	if (jQuery(at).length > 0) {
                		canvas = jQuery(at)[0];
                		canvas.width = jQuery(at).width();
                		canvas.height = jQuery(at).height();
                	}
                	if (jQuery(pu).length > 0) {
                		canvas = jQuery(pu)[0];
                		canvas.width = jQuery(pu).width();
                		canvas.height = jQuery(pu).height();
                	}
                	}


                createElements() {
                		// we need to add a couple of divs into the this.id element
                		// <canvas id=\"mpr1\" class=\"primary\" draggable=\"false\" ondragstart=\"return false;\"></canvas>");
                		this.primary = document.createElement('canvas');
                		jQuery(this.primary).addClass('primary');
                		jQuery(this.primary).attr('draggable', 'false');
                		jQuery(this.primary).attr('ondragstart', 'return false;');
                		jQuery(this.id).append(this.primary);

                	// <canvas id="mpr1_overlay" class="overlay" draggable="false" ondragstart="return false;"></canvas>
                	this.overlay = document.createElement('canvas');
                	jQuery(this.overlay).addClass('overlay');
                	jQuery(this.overlay).attr('draggable', 'false');
                	jQuery(this.overlay).attr('ondragstart', 'return false;');
                	jQuery(this.id).append(this.overlay);

                	//<canvas id="mpr1_atlas" class="atlas" draggable="false" ondragstart="return false;"></canvas>
                	this.atlas = document.createElement('canvas');
                	jQuery(this.atlas).addClass('atlas');
                	jQuery(this.atlas).attr('draggable', 'false');
                	jQuery(this.atlas).attr('ondragstart', 'return false;');
                	jQuery(this.id).append(this.atlas);

                	//<div id="mpr1_atlas2" class="atlas2" draggable="false" ondragstart="return false;"></div>
                	this.atlas2 = document.createElement('div');
                	jQuery(this.atlas2).addClass('atlas2');
                	jQuery(this.atlas2).attr('draggable', 'false');
                	jQuery(this.atlas2).attr('ondragstart', 'return false;');
                	jQuery(this.id).append(this.atlas2);

                	//<div class="message" style="bottom: 0px; right: 5px;"><span id="mpr1_message1"></span></div>
                	var message1_div = document.createElement('div');
                	jQuery(message1_div).addClass('message');
                	jQuery(message1_div).css('bottom', '0px');
                	jQuery(message1_div).css('right', '5px');
                	this.message1 = document.createElement('span');
                	jQuery(message1_div).append(this.message1);
                	jQuery(this.id).append(message1_div);

                	//<div class="message" style="bottom: 20px; right: 5px;"><span id="mpr1_message2"></span></div>
                	var message2_div = document.createElement('div');
                	jQuery(message2_div).addClass('message');
                	jQuery(message2_div).css('bottom', '20px');
                	jQuery(message2_div).css('right', '5px');
                	this.message2 = document.createElement('span');
                	jQuery(message2_div).append(this.message2);
                	jQuery(this.id).append(message2_div);

                	//<div class="message" style="bottom: 40px; right: 5px;"><span id="mpr1_message3"></span></div>
                	var message3_div = document.createElement('div');
                	jQuery(message3_div).addClass('message');
                	jQuery(message3_div).css('bottom', '40px');
                	jQuery(message3_div).css('right', '5px');
                	this.message3 = document.createElement('span');
                	jQuery(message3_div).append(this.message3);
                	jQuery(this.id).append(message3_div);

                	//<div class="crosshair-horizontal"></div>
                	this.crosshair_horizontal = document.createElement('div');
                	jQuery(this.crosshair_horizontal).addClass('crosshair-horizontal');
                	jQuery(this.id).append(this.crosshair_horizontal);

                	//<div class="crosshair-vertical"></div>
                	this.crosshair_vertical = document.createElement('div');
                	jQuery(this.crosshair_vertical).addClass('crosshair-vertical');
                	jQuery(this.id).append(this.crosshair_vertical);

                	this.ctx1 = this.primary.getContext("2d");
                	this.ctx1_overlay = this.overlay.getContext("2d");
                	this.ctx1_atlas = this.atlas.getContext("2d");
                	}
                	tim() {
                		var stopTiming = false;
                		if (!this.requireNewDraw && !this.requireNewDraw_overlay && !this.requireNewDraw_atlas) {
                			if (position[0] >= this.dims[0]) {
                				var end = new Date().getTime();
                				var t = (end - start);
                				var tt = "Rendering Time: " + t + "ms for " + this.dims[0] + " slices [" + ((this.dims[0] / t) * 1000.0).toFixed(0) + " slices/sec].";
                				setTimeout(function() {
                					jQuery(this.message3).text(tt);
                				}, 100);
                				console.log(tt);
                				stopTiming = true;
                			}
                			if (position[0] <= this.dims[0]) {
                				position[0]++;
                			}
                		}
                		if (!stopTiming) {
                			setTimeout(tim, 1);
                		}
                	};

                // get a webASEG.json and webASEG folder from the harddrive (created by Matlab)
                readWebASEG(json_filename, callback) {
                	var p = json_filename.split(/\//g);
                	p.pop();
                	var path = p.join('/');
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
                constructor(options, dom_element) {
                		// we would want to change the default theme?
                		if (typeof options != 'undefined') {
                			this.theme = options;
                		}
                		if (typeof dom_element == 'undefined' || jQuery(dom_element).length == 0) {
                			console.log("ERROR: we need a dom_element that exists on the page");
                			return;
                		}
                		this.id = dom_element;
                		if (typeof options['imageWidth'] !== 'undefined') {
                			this.imageWidth = options['imageWidth'];
                		}
                		if (typeof options['imageHeight'] !== 'undefined') {
                			this.imageHeight = options['imageHeight'];
                		}
                		if (typeof options['dims'] !== 'undefined') {
                			this.dims = options['dims'];
                		}
                		// what is x and y?
                		if (typeof options["viewIndex"] !== 'undefined') {
                			this.viewIndex = options["viewIndex"];
                		}

                		this.numImagesX = Math.floor(this.imageWidth / this.dims[this.viewIndex[0]]);
                		this.numImagesY = Math.floor(this.imageHeight / this.dims[this.viewIndex[1]]);

                		if (typeof options["position"] != 'undefined') {
                			this.position = options["position"];
                		}

                		if (typeof options["underlay_path"] != 'undefined') {
                			this.underlay_file = options["underlay_path"];
                		}

                		if (typeof options["overlay_path"] != 'undefined') {
                			this.overlay_path = options["overlay_path"];
                } else {
                	this.overlay_path = "";
                }
                if (typeof options["atlas_path"] != 'undefined') {
                	this.atlas_path = options["atlas_path"];
                } else {
                	this.atlas_path = "";
                }
                if (typeof options["atlas_placeholder"] != 'undefined') {
                	this.atlas_placeholder = options["atlas_placeholder"];
                } else {
                	this.atlas_placeholder = "";
                }
                if (typeof options["sliceDirection"] != 'undefined') {
                	this.sliceDirection = options["sliceDirection"];
                }

                // create the div's we need on the webpage (including cross-hairs)
                this.createElements(); // now this.primary, this.overlay, and this.atlas2 exist

                this.Primary.src = this.underlay_file; // "data/Atlas/T1AtlasAxial.jpg"; // preload T1 image
                this.Primary.onload = function(self) {
                	return function() {
                		console.log("loading of T1 cache canvas is finished");
                		self.primary_loaded = true;
                		self.drawMPR.call(self, null); // start our render loop
                	};
                }(this);
                jQuery(this.message1).text("Loading data for primary... ");
                jQuery(this.message2).text("Loading data for overlay... ");

                if (typeof(this.overlay_path) != 'undefined' && this.overlay_path.length > 0) {
                	this.readOverlayRawFile(this.overlay_path, function(arrayBufferView) {
                				// ok we have the data loaded now lets add them to the overlay_image_data
                				if (this.overlay_loaded)
                					return;

                		this.OverlayRawData = arrayBufferView;

                		// maybe we don't have OverlayOrig yet, we should create such an image???
                		var OverlayOrig = new Image(this.imageWidth, this.imageHeight); // 3000, 3900);

                		// We need a new canvas for the processing of the overlay - this is very slow and
                		// is not done online - for now. A web-worker would be nice.
                		var canvas = document.createElement("canvas");
                		canvas.width = OverlayOrig.width; // this is 4096
                		canvas.height = OverlayOrig.height; // this 4096
                		var context = canvas.getContext("2d");
                		// where is OverlayOrig coming from?
                		context.drawImage(OverlayOrig, 0, 0); // nothing in there yet
                		var overlay_image_data = context.getImageData(0, 0, OverlayOrig.width, OverlayOrig.height);
                		// apply the transfer function now
                		var minV = 0;
                		var maxV = 0;
                		for (var i = 0; i < OverlayOrig.width * OverlayOrig.height; i++) {
                			if (minV > arrayBufferView[i])
                				minV = arrayBufferView[i];
                			if (maxV < arrayBufferView[i])
                				maxV = arrayBufferView[i];
                		}
                		var symMax = Math.max(Math.abs(minV), Math.abs(maxV)); // could be all negative!
                		if (typeof(this.theme.overlay.colormap.max) != 'undefined')
                			symMax = this.theme.overlay.colormap.max;

                		// this is slow because we access every pixel in the whole volume
                		var threshold = 0; //symMax/20; // plus/minus (beta, mask)
                		if (typeof(this.theme.overlay.colormap.blank_out) != 'undefined')
                			threshold = this.theme.overlay.colormap.blank_out;

                		var exponent = 0.5; // change the transparency to make it more easier to see
                		if (typeof(this.theme.overlay.colormap.gamma) != 'undefined')
                			exponent = this.theme.overlay.colormap.gamma;

                		console.log("Overlay: range is -" + symMax.toFixed(3) + ".." + symMax.toFixed(3));

                		var middle = Math.floor(redblackblue.length / 2);
                		for (var y = 0; y < OverlayOrig.height; y++) {
                			for (var x = 0; x < OverlayOrig.width; x++) {
                				var i = y * OverlayOrig.width + x;
                				//var j = y * OverlayOrig.width + x;

                				if (Math.abs(arrayBufferView[i]) < threshold) {
                					overlay_image_data.data[i * 4 + 3] = 0;
                				} else {
                					//var idx = middle + Math.floor((arrayBufferView[i] - threshold) / (symMax*2.0 -  threshold) * middle);
                					var idx = middle + Math.round((arrayBufferView[i] / symMax) * middle);
                					// switch the colormap around (red should be positive)
                					idx = middle - (idx - middle);
                					var opacity = Math.pow(Math.abs(arrayBufferView[i] / symMax), exponent);
                					overlay_image_data.data[i * 4 + 3] = opacity * 255; // Math.max(0, Math.min(2*Math.pow(Math.abs(idx - middle),exponent),255));
                					// lets use a colormap entry
                					//if (typeof(redblackblue[idx]) == 'undefined')
                					//    console.log("ERROR")
                					// use clamping
                					idx = Math.max(0, Math.min(idx, redblackblue.length));
                					overlay_image_data.data[i * 4 + 0] = 255 * redblackblue[idx][0];
                					overlay_image_data.data[i * 4 + 1] = 255 * redblackblue[idx][1];
                					overlay_image_data.data[i * 4 + 2] = 255 * redblackblue[idx][2];
                				}
                				}
                				}
                				//for (var i = 0; i < OverlayOrig.width * OverlayOrig.height; i++) {
                				//}
                				context.putImageData(overlay_image_data, 0, 0);
                				// from that context canvas we can create a new image that we can use with drawImage
                				var url = canvas.toDataURL();
                				this.Overlay.src = url;
                				this.Overlay.onload = function(self) {
                					return function() {
                						self.overlay_loaded = true;
                						console.log("processing of overlay cache for canvas is finished");
                					};
                				}(this);
                				console.log("loading of overlay cache for canvas is finished");
                				})
                				}
                				if (typeof(this.atlas_path) != 'undefined' && this.atlas_path.length > 0) {
                					readWebASEG(this.atlas_path, function(self) {
                								return function(data) {
                										self.atlas_webASEG = data;
                										//console.log("DONE reading webASEG"); 
                										// given a threshold we can create a volume of labels
                										var threshold = self.theme.atlas.prob_threshold;
                										var accuracy = self.theme.atlas.simplify_error; // how accurate is the outline? Error allowed after simplifying polygon
                										// we should stuff this into an image (the label as unsigned short)

                						// instead of using the FreeSurfer colors in atlas_colors, we need to create our own 
                						// description based on the entries in data.roinames and data.roicodes
                						// structure should be:
                						// var atlas_colors = {
                						//   "0": ["Unknown", 0, 0, 0, 0],
                						//   "1": ["Left - Cerebral - Exterior", 70, 130, 180, 0],

                						var local_atlas_colors = {};
                						for (var i = 0; i < data.roicodes.length; i++) {
                							local_atlas_colors[data.roicodes[i]] = [data.roinames[i], 255, 255, 255, 0];
                						}

                						if (typeof(self.atlas_w2) == "undefined") {
                							self.atlas_w2 = new Worker("js/atlas_worker2.js");
                						}
                						if (self.atlas_w2) {
                							self.atlas_w2.onmessage = function(event) {
                									if (event.data['action'] == "message") {
                										if (typeof(event.data["text"]) != "undefined")
                											console.log("Got an event from the atlas worker: " + event.data["text"]);
                									}
                									if (event.data['action'] == "OpenCVReady") {
                										async function loadAtlas() {
                												// todo: We don't need to read an image here. Would be sufficient to just
                												// create it here.
                                            let AtlasImage16bit = await IJS.Image.load(self.atlas_placeholder);
                                            var start = [0, 0];
                                            var end = [self.Primary.width, self.Primary.height]; // should be 3000, 3900
                                            self.copyWebASEG(self.atlas_webASEG, AtlasImage16bit, threshold, start, end, dims);
                                            self.atlas_w2.postMessage({
                                            			"pixels16bit": AtlasImage16bit, // target for the the image
                                            			"atlas_colors": local_atlas_colors,
                                            			"start": start,
                                            			"end": end,
                                                "dims": [self.dims[self.viewIndex[0]], self.dims[self.viewIndex[1]]],
                                                "accuracy": accuracy
                                                });
                                                return AtlasImage16bit;
                                                };
                                                AtlasImage16bit = loadAtlas().catch(console.error);
                                                }
                                                if (typeof(event.data["result"]) !== "undefined") {
                                                	self.atlas_outlines = [];
                                                	self.atlas_outlines_labels = [];
                                                	var keys = Object.keys(event.data["result"]);
                                                	for (var i = 0; i < keys.length; i++) {
                                                		self.atlas_outlines[keys[i]] = event.data["result"][keys[i]]["contour_array"];
                                                		self.atlas_outlines_labels[keys[i]] = event.data["result"][keys[i]]["label_array"];
                                                	}
                                                	console.log("received the atlas outlines and the atlas labels...");
                                                } // end of onmessage
                                                };
                                                }
                                                };
                    }(this));
                }
                // we need to adjust the width and height values in the canvas to make the aspect ratio work
                jQuery(window).resize(function(self) {
                	return function() {
                		self.resize();
                	};
                }(this));
                this.resize();

                jQuery(this.primary).on('DOMMouseScroll mousewheel', function(self) {
                	var sliceDim = 0;
                	if (0 != self.viewIndex[0] && 0 != self.viewIndex[1]) {
                		sliceDim = 0;
                	}
                	if (1 != self.viewIndex[0] && 1 != self.viewIndex[1]) {
                		sliceDim = 1;
                	}
                	if (2 != self.viewIndex[0] && 2 != self.viewIndex[1]) {
                		sliceDim = 2;
                	}
                	return function(e) {
                		if (e.originalEvent.wheelDelta / 120 > 0) {
                			position[sliceDim]++;
                			if (position[sliceDim] >= dims[sliceDim])
                				position[sliceDim] = 0;
                		} else if (e.originalEvent.wheelDelta / 120 < 0) {
                			position[sliceDim]--;
                			if (position[sliceDim] < 0)
                				position[sliceDim] = dims[sliceDim] - 1;
                		}
                	};
                }(this));
                ["mousedown", "mouseup", "mousemove"].forEach(function(self) {
                	return function(name) {
                		if (typeof self.primary != 'undefined')
                			jQuery(self.primary).on(name, self.mouseEvents.bind(self));
                	};
                }(this));

                jQuery(this.primary).on('dragstart', function(e) {
                	e.preventDefault();
                });
                jQuery(this.primary).on('swipeup', function(e) {
                	e.preventDefault();
                });
                jQuery(this.primary).on('swipedown', function(e) {
                	e.preventDefault();
                });
                jQuery(this.overlay).on('dragstart', function(e) {
                	e.preventDefault();
                });
                jQuery(this.overlay).on('swipeup', function(e) {
                	e.preventDefault();
                });
                jQuery(this.overlay).on('swipedown', function(e) {
                	e.preventDefault();
                });
                jQuery(document).on('keydown', this.primary, function(self) {
                			return function(e) {
                					if (e.which == 49) {
                						self.theme.atlas.colorByLabel = !self.theme.atlas.colorByLabel;
                					}
                					if (e.which == 50) { // 2
                						if (jQuery(self.overlay).is(":visible"))
                							jQuery(self.overlay).hide();
                						else
                							jQuery(self.overlay).show();
                					}
                					if (e.which == 51) {
                						if (jQuery(self.atlas2).is(":visible"))
                							jQuery(self.atlas2).hide();
                						else
                							jQuery(self.atlas2).show();
                					}
                					if (e.which == 52) {
                						if (jQuery(self.primary).is(":visible"))
                							jQuery(self.primary).hide();
                						else
                							jQuery(self.primary).show();
                					}
                					if (e.which == 84) { // 't'
                						// do some timing of the rendering, we want to draw as fast as we can
                						position[0] = 0;
                						// force a redraw of all
                						self.requireNewDraw_atlas = true;
                						self.requireNewDraw_overlay = true;
                						self.requireNewDraw = true;
                						//var start = new Date().getTime();

                			setTimeout(tim, 1);
                			}
                			};
                			}(this));

                } // constructor end
                }

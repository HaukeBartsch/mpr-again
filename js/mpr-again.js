// library for a single MPR viewer

class MPR_AGAIN {

	static mouse = {
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

	drawMPR(timestamp) {
		if (this.primary_loaded && this.theme.primary.show) {
			this.updateMPRPrimary();
		}
		if (this.overlay_loaded && this.theme.overlay.show) {
			this.updateMPROverlay();
		}
		if (this.atlas_outlines && this.theme.atlas.show) {
			//this.updateAtlasOverlays();
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
			this.overlay_file = options["overlay_path"];
		} else {
			this.overlay_file = "";
		}

		if (typeof options["sliceDirection"] != 'undefined') {
			this.sliceDirection = options["sliceDirection"];
		}

		// create the div's we need on the webpage (including cross-hairs)
		this.createElements();

		this.Primary.src = this.underlay_file; // "data/Atlas/T1AtlasAxial.jpg"; // preload T1 image
		this.Primary.onload = function(self) {
			return function() {
				console.log("loading of T1 cache canvas is finished");
				self.primary_loaded = true;
				self.drawMPR.call(self, null); // start our render loop
			};
		}(this);

		if (this.overlay_file.length > 0) {
			this.readOverlayRawFile(this.overlay_file, function(arrayBufferView) {
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
	}

}

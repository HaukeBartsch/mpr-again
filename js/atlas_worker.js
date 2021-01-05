var regionsBySlide;

// if we want to load OpenCV.js in this worker we need to wait for Module to fill up, after the promise...
var Module = {
	onRuntimeInitialized() {
		// this is our application:
		if (typeof cv === "object")
			console.log(cv.getBuildInformation())
	}
};
self.importScripts("/js/opencv.js");
if (typeof cv === "function") {
	const promise = cv().then(function() {
		console.log("cv loaded");
		cv = Module; // this looks broken, but I don't know how to fulfill the promise any other way
	}, function() {
		console.log("Loading of OpenCV failed...");
	});
}

waitForOpencv(function(success) {
	if (success) {
		postMessage({
			"action": "OpenCVReady",
			"text": "done loading (opencv)"
		});
	} else {
		console.log("perceived error loading opencv");
		//throw new Error('Error on loading OpenCV');
	}
});

onmessage = function (e) {
    console.log("Message received in atlas worker.");
    if (typeof(e.data["pixels16bit"]) !== "undefined") {
    	// we got 16bit data for processing here
    	// we can loop through all the images between start end end
    	var image = e.data["pixels16bit"];
    	var start = e.data["start"]; // start and end don't know about 4 bytes in RGBA
    	var end = e.data["end"];
        var dims = e.data["dims"];
        var atlas_colors = e.data["atlas_colors"];
    	if (typeof end[0] == 'undefined' || typeof dims[0] == 'undefined')
    		console.log("found bla bla");

    	var numImX = Math.floor(end[0] / dims[0]);
    	var numImY = Math.floor(end[1] / dims[1]);
    	var count = 0;
    	regionsBySlide = {};
    	for (var y = 0; y < numImY; y++) {
    		postMessage({
    			"action": "message",
    			"text": "num " + (y + 1) + " of " + numImY
    		});
    		for (var x = 0; x < numImX; x++) {
    			var s = [start[0] + x * dims[0], start[1] + y * dims[1]];
    			var e = [s[0] + dims[0], s[1] + dims[1]];
                regionsBySlide[numImX * x + y] = parseData2(image, canvas_id, s, e, atlas_colors);
    			count++;
    		}
        }
        // We should also have a legend here, by slice list all the rois with a 
        // center point at which to show the label - and the label.

    	postMessage({
    		"action": "message",
    		"text": "done processing (in parseData of the webworker)!",
    		"result": regionsBySlide
    	});

    	return;
    }

    var image = e.data["pixels"];
    var canvas_id = e.data['canvas_id'];
    var start = e.data["start"]; // start and end don't know about 4 bytes in RGBA
    var end = e.data["end"];
    var dims = e.data["dims"];

    postMessage({ "action": "message", "text": "got an image object of length: " + image.data.length });

    // we can loop through all the images between start end end
    var numImX = Math.floor(end[0] / dims[0]);
    var numImY = Math.floor(end[1] / dims[1]);
    var count = 0;
    regionsBySlide = {};
    for (var y = 0; y < numImY; y++) {
        postMessage({ "action": "message", "text": "num " + (y + 1) + " of " + numImY });
        for (var x = 0; x < numImX; x++) {
            var s = [start[0] + x * dims[0], start[1] + y * dims[1]];
            var e = [s[0] + dims[0], s[1] + dims[1]];
            regionsBySlide[numImX * x + y] = parseData2(image, canvas_id, s, e);
            count++;
        }
    }
    postMessage({ "action": "message", "text": "done processing (in parseData of the webworker)!", "result": regionsBySlide });
}

Object.defineProperty(Array.prototype, 'chunk', {
	value: function(chunkSize) {
		var R = [];
		for (var i = 0; i < this.length; i += chunkSize)
			R.push(this.slice(i, i + chunkSize));
		return R;
	}
});

function parseData2(image, canvas_slice_id, start, end, atlas_colors) {
	let dat = [];
	var w = image.width;
	var h = image.height;
	var channel = 1;
	for (var y = start[1]; y < end[1]; y++) { // for each of the rows get the slice of the data
		var idx1 = (start[0] * channel) + (y * (w * channel));
		var idx2 = idx1 + (channel * (end[0] - start[0]));
		dat = dat.concat(Array.from(image.data.slice(idx1, idx2)));
	}
	dat.width = end[0] - start[0];
	dat.height = end[1] - start[1];
	let src = cv.matFromArray(dat.width, dat.height, cv.CV_16UC1, dat);
	let src2 = new cv.Mat(); // .zeros(src.cols, src.rows, cv.CV_8UC4);
	var labelsInThisSlice = {};
	for (var i = 0; i < dat.length; i += 4) {
		if (dat[i] > 0) {
			labelsInThisSlice[dat[i]] = 1;
		}
	}
	labelsInThisSlice = Object.keys(labelsInThisSlice);
    var contour_array = {};
    var label_array = {}; // store the location of each label for a contour
	for (var labelIdx = 0; labelIdx < labelsInThisSlice.length; labelIdx++) {
        var label = parseInt(labelsInThisSlice[labelIdx]);
        // for now remove some of the large label (white and gray matter)
        if (label == 1 || label == 2 || label == 3 || label == 40 || label == 41 || label == 42) {
        	continue;
        }
		const lower = cv.matFromArray(1, 1, cv.CV_16UC1, [
			label
		]);
		const higher = cv.matFromArray(1, 1, cv.CV_16UC1, [
			label
		]);
        cv.inRange(src, lower, higher, src2);
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(src2, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
        var idx = 1;
        for (let i = 0; i < contours.size(); i++) {
            if (i == 0) {
                contour_array[label] = [];
                label_array[label] = [];
                }
            // simplify the contour
        	let tmp = new cv.Mat();
        	let cnt = contours.get(i);
            cv.approxPolyDP(cnt, tmp, 0.1, true);
            let moments = cv.moments(cnt, false);
            let centroid_x = moments.m10 / moments.m00;
            let centroid_y = moments.m01 / moments.m00;
            let area = cv.contourArea(cnt);
            let perimeter = cv.arcLength(cnt, true);
        	var data = Array.from(tmp.data).chunk(4).map(function(a) {
        		return a[0];
        	}).chunk(2);
            contour_array[label].push(data);
            label_array[label].push({
            	centroid: [centroid_x, centroid_y],
            	area: area,
            	perimeter: perimeter,
            	label: label,
            	name: atlas_colors[label][0]
            });
        }
        contours.delete();
        hierarchy.delete();
    }
    src.delete();
    src2.delete();
    return {
    	contour_array: contour_array,
    	label_array: label_array
    };
}

function parseData(image, start, end) {
    // we should start processing the image here
    var width = image.width;
    var height = image.height;

    //  scan-line algorithm in the box defined by start/end
    // we have to look in +x and in +y to see all the borders
    var points = [...Array(4096).keys()].map(function (x) { return []; });
    //    for (var i = 0; i < 4096; i++) {
    //        points[i] = [];
    //    }
    for (var y = start[1]; y < end[1] - 1; y++) {
        var idx0 = y * width * 4 + (start[0] * 4); // the row above
        var idx1 = (y + 1) * width * 4 + (start[0] * 4); // the row below
        for (var x = start[0]; x < end[0] - 1; x++) {

            // we only need to check the red component in the image
            var val0 = image.data[idx0];
            var val1 = image.data[idx0 + 4]; // next right
            var val2 = image.data[idx1]; // next down
            if (val0 != val1) { // integer compare
                // add the first point
                if (val0 != 0) {
                    points[val0].push([
                        x + 0.4, y
                    ]);
                }
                if (val1 != 0) {
                    points[val1].push([
                        x + 0.6, y
                    ]);
                }
            }
            if (val0 != val2) {
                // add the first point
                if (val0 != 0) {
                    points[val0].push([
                        x, y + 0.4
                    ]);
                }
                if (val2 != 0) {
                    points[val2].push([
                        x, y + 0.6
                    ]);
                }
            }

            // just advance the idx
            idx0 += 4;
            idx1 += 4;
        }
        // next we need to connect the points with line segments
    }
    return points.filter(function (a) { return a.length > 0; });
}

function waitForOpencv(callbackFn, waitTimeMs = 60000, stepTimeMs = 100) {
    if (cv.Mat) callbackFn(true)

    let timeSpentMs = 0
    const interval = setInterval(() => {
        const limitReached = timeSpentMs > waitTimeMs
        if (cv.Mat || limitReached) {
            clearInterval(interval)
            return callbackFn(!limitReached)
        } else {
            timeSpentMs += stepTimeMs
        }
    }, stepTimeMs)
}
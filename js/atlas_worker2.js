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
self.importScripts("/js/labelPolygon.js");

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
        var canvas_id = e.data['canvas_id'];
    	var image = e.data["pixels16bit"];
    	var start = e.data["start"]; // start and end don't know about 4 bytes in RGBA
    	var end = e.data["end"];
        var dims = e.data["dims"];
        var atlas_colors = e.data["atlas_colors"];
        var accuracy = 0.2; // how detailed in the polygon approximation?
        if (typeof e.data["accuracy"] != 'undefined')
            accuracy = e.data["accuracy"];
    	//if (typeof end[0] == 'undefined' || typeof dims[0] == 'undefined')
    	//	console.log("found bla bla");

    	var numImX = Math.floor(end[0] / dims[0]);
    	var numImY = Math.floor(end[1] / dims[1]);
    	regionsBySlide = {};
    	for (var x = 0; x < numImX; x++) {
    		postMessage({
    			"action": "message",
    			"text": "num " + (x + 1) + " of " + numImX
    		});
    		for (var y = 0; y < numImY; y++) {
    			var s = [start[0] + x * dims[0], start[1] + y * dims[1]];
    			var e = [s[0] + dims[0], s[1] + dims[1]];
                regionsBySlide[numImX * x + y] = parseData2(image, canvas_id, s, e, atlas_colors, accuracy);
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

    postMessage({ "action": "message", "text": "got an image object of length: " + image.data.length });

    // we can loop through all the images between start end end
/*    var numImX = Math.floor(end[0] / dims[0]);
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
    postMessage({ "action": "message", "text": "done processing (in parseData of the webworker)!", "result": regionsBySlide }); */ 
}

Object.defineProperty(Array.prototype, 'chunk', {
	value: function(chunkSize) {
		var R = [];
		for (var i = 0; i < this.length; i += chunkSize)
			R.push(this.slice(i, i + chunkSize));
		return R;
	}
});

function parseData2(image, canvas_slice_id, start, end, atlas_colors, accuracy) {
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
    // how many rows? (Height many), how many columns? (Rows many)
	let src = cv.matFromArray(dat.height, dat.width, cv.CV_16UC1, dat);
	let src2 = new cv.Mat(); // .zeros(src.cols, src.rows, cv.CV_8UC4);
	var labelsInThisSlice = {};
	for (var i = 0; i < dat.length; i++) {
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
        if (label == 1  // left cerebral white matter
            || label == 2 // left cerebral cortex
            || label == 16 // CSF
            || label == 21 // Right cerebral white matter
            || label == 22 // right cerebral cortex
            ) {
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
        // TODO: this retrieves the contours in a 2 level hierarchy. This means that we have information
        // about holes in contour - but our code below does not use that information!
        cv.findContours(src2, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
        var idx = 1;
        for (let i = 0; i < contours.size(); i++) {
            // I assume that in some cases a contour has more than one array,
            // those are rings (holes). We should keep them in the structure for polylabel.
            if (i == 0) {
                contour_array[label] = [];
                label_array[label] = [];
            }
            // simplify the contour
        	let tmp = new cv.Mat();
        	let cnt = contours.get(i);
            // do we have a hole here?
            let hole = false;
            let hier = hierarchy.intPtr(0,i);
            if (hier[3] != -1) {
                //console.log("we have a hole here...");
                hole = true;
            }

            // we can set the accuracy to 10% or the arc-length
            //accuracy = 0.01*cv.arcLength(cnt, true);
            cv.approxPolyDP(cnt, tmp, accuracy, true);
            let moments = cv.moments(cnt, false);
            let centroid_x = moments.m10 / moments.m00;
            let centroid_y = moments.m01 / moments.m00;
            let area = cv.contourArea(cnt);
            let perimeter = cv.arcLength(cnt, true);
        	var data = Array.from(tmp.data).chunk(4).map(function(a) {
        		return a[0];
        	}).chunk(2);
            contour_array[label].push(data);
            // We could do better here for the placement of labels.
            // Best would be to find the largest inscribing circle for the
            // polygon and to place the label at that location. This
            // can be done brute force using a pointPolygonTest on all
            // grid locations inside the contour.
            var center = polylabel([data], 0.1);

            label_array[label].push({
                centroid: [center[0], center[1]],
                inclosing_radius: center.distance,
            	area: area,
            	perimeter: perimeter,
            	label: label,
                hole: hole,
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